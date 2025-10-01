// components/RocketSimulator.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
// import styles from '../styles/RocketSimulator.module.css'; // Remove this

// Constants (can be moved to a separate config file if they grow)
const EARTH_RADIUS_KM = 6371;
const EARTH_MASS_KG = 5.972e24;
const G_CONST = 6.67430e-11;
const SPACE_BOUNDARY_KM = 100;
const LOW_EARTH_ORBIT_MIN_KM = 160;
const LOW_EARTH_ORBIT_MAX_KM = 2000;
const EXHAUST_VELOCITY_MPS = 4500;
const ROCKET_DRY_MASS_TONS_STAGE1 = 50;
const ROCKET_DRY_MASS_TONS_STAGE2 = 20;


const RocketSimulator = () => {
    // --- STATE (Same as before) ---
    const [thrustKn, setThrustKn] = useState(5000);
    const [fuelCapacityTons, setFuelCapacityTons] = useState(250);
    const [burnRateTps, setBurnRateTps] = useState(20);
    const [initialLaunchAngleDeg, setInitialLaunchAngleDeg] = useState(89);
    const [gravityMps2, setGravityMps2] = useState(9.8);
    const [atmosphereDensityMultiplier, setAtmosphereDensityMultiplier] = useState(1.0);
    const [targetAltitudeKm, setTargetAltitudeKm] = useState(400);
    const [stageTimingSeconds, setStageTimingSeconds] = useState(120);
    const [altitudeKm, setAltitudeKm] = useState(0);
    const [velocityKmps, setVelocityKmps] = useState(0);
    const [accelerationMps2, setAccelerationMps2] = useState(0);
    const [angleDeg, setAngleDeg] = useState(90);
    const [fuelRemainingTons, setFuelRemainingTons] = useState(fuelCapacityTons);
    const [currentStage, setCurrentStage] = useState(1);
    const [currentMassTons, setCurrentMassTons] = useState(ROCKET_DRY_MASS_TONS_STAGE1 + fuelCapacityTons);
    const [currentThrustOutputKn, setCurrentThrustOutputKn] = useState(0);
    const [apogeeKm, setApogeeKm] = useState(0);
    const [perigeeKm, setPerigeeKm] = useState(0);
    const [orbitalPeriodMin, setOrbitalPeriodMin] = useState(0);
    const [orbitalVelocityKmps, setOrbitalVelocityKmps] = useState(0);
    const [messages, setMessages] = useState(["System initialized. Ready for launch configuration."]);
    const [stageIndicatorText, setStageIndicatorText] = useState("Pre-Launch");
    const [achievementText, setAchievementText] = useState("");
    const [achievementVisible, setAchievementVisible] = useState(false);
    const [missionStatusText, setMissionStatusText] = useState("Ready for launch.");
    const [simTimeS, setSimTimeS] = useState(0);
    const [launched, setLaunched] = useState(false);
    const [crashed, setCrashed] = useState(false);
    const [inOrbit, setInOrbit] = useState(false);
    const [rocketPosKm, setRocketPosKm] = useState({ x: 0, y: EARTH_RADIUS_KM });
    const [rocketVelKmps, setRocketVelKmps] = useState({ x: 0, y: 0 });
    const [rocketAccelMps2, setRocketAccelMps2] = useState({ x: 0, y: 0 });
    const [achievements, setAchievements] = useState({
        reachedSpace: false,
        reachedOrbit: false,
        completedMission: false
    });

    // --- REFS (Same as before) ---
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const animationIdRef = useRef(null);
    const canvasContainerRef = useRef(null);

    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
    const [displayScale, setDisplayScale] = useState(0.05);
    const [centerX, setCenterX] = useState(400);
    const [centerY, setCenterY] = useState(300);

    // --- HELPER FUNCTIONS (Same as before, ensure they don't rely on old styles object) ---
     const addMessage = useCallback((msg) => {
        setMessages(prev => [msg, ...prev.slice(0, 5)]);
    }, []);

    const showAchievement = useCallback((msg) => {
        setAchievementText(msg);
        setAchievementVisible(true);
        setTimeout(() => {
            setAchievementVisible(false); 
            setTimeout(() => setAchievementText(""), 500);
        }, 3000);
    }, []);

    const calculateCurrentAltitudeKm = useCallback((position) => {
        return Math.sqrt(position.x * position.x + position.y * position.y);
    }, []);
    
    const disableControls = launched && !crashed && !inOrbit;


    // --- EFFECTS (Largely the same, remove any style manipulations if they existed) ---
    // Canvas Resizing and Initialization Effect
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = canvasContainerRef.current;
        if (!canvas || !container) return;
        ctxRef.current = canvas.getContext('2d');
        const resize = () => {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            canvas.width = newWidth;
            canvas.height = newHeight;
            setCanvasSize({ width: newWidth, height: newHeight });
            setCenterX(newWidth / 2);
            setCenterY(newHeight / 2);
            const maxDimension = Math.min(newWidth, newHeight);
            setDisplayScale(maxDimension / (EARTH_RADIUS_KM + targetAltitudeKm * 2) * 0.8);
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [targetAltitudeKm]);

    // Initial Fuel & Mass Setting Effect
    useEffect(() => {
        setFuelRemainingTons(fuelCapacityTons);
        setCurrentMassTons(ROCKET_DRY_MASS_TONS_STAGE1 + fuelCapacityTons);
    }, [fuelCapacityTons]);

    // Drawing Functions (Same logic, ensure no style object references)
    const drawStars = useCallback(() => {
        if (!ctxRef.current) return;
        const ctx = ctxRef.current;
        const numStars = 200;
        ctx.fillStyle = '#ffffff'; // White stars
        for (let i = 0; i < numStars; i++) {
            const x = (Math.sin(i * 3.74 + simTimeS * 0.001) * 0.5 + 0.5) * canvasSize.width;
            const y = (Math.cos(i * 2.51 + simTimeS * 0.001) * 0.5 + 0.5) * canvasSize.height;
            const size = (Math.sin(i * 8.72) * 0.5 + 0.5) * 2 + 0.5;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [canvasSize.width, canvasSize.height, simTimeS]);

    const drawEarth = useCallback(() => {
        if (!ctxRef.current) return;
        const ctx = ctxRef.current;
        const earthScreenRadius = EARTH_RADIUS_KM * displayScale;

        const earthGradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, earthScreenRadius
        );
        earthGradient.addColorStop(0, '#3b82f6'); // Tailwind blue-500
        earthGradient.addColorStop(0.8, '#2563eb'); // Tailwind blue-600
        earthGradient.addColorStop(1, '#1d4ed8'); // Tailwind blue-700
        
        ctx.fillStyle = earthGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, earthScreenRadius, 0, Math.PI * 2);
        ctx.fill();

        // Atmosphere
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)'; // Tailwind blue-400 with alpha
        ctx.lineWidth = Math.max(1, 15 * displayScale * 0.05); // Scale linewidth, ensure min 1px
        ctx.beginPath();
        ctx.arc(centerX, centerY, earthScreenRadius + 10 * displayScale, 0, Math.PI * 2);
        ctx.stroke();

        // Kármán line
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.2)'; // Tailwind pink-500 with alpha
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, (EARTH_RADIUS_KM + SPACE_BOUNDARY_KM) * displayScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }, [displayScale, centerX, centerY]); // Removed canvasSize as it's implicit in centerX/Y

    const drawTargetOrbit = useCallback(() => {
        if (!ctxRef.current) return;
        const ctx = ctxRef.current;
        const orbitScreenRadius = (EARTH_RADIUS_KM + targetAltitudeKm) * displayScale;

        ctx.strokeStyle = 'rgba(229, 231, 235, 0.3)'; // Tailwind gray-200 with alpha
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbitScreenRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(229, 231, 235, 0.7)'; // Tailwind gray-200 with alpha
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        if (centerX + orbitScreenRadius + 5 < canvasSize.width - 50) {
          ctx.fillText(targetAltitudeKm + ' km', centerX + orbitScreenRadius + 5, centerY);
        } else {
          ctx.textAlign = 'right';
          ctx.fillText(targetAltitudeKm + ' km', centerX - orbitScreenRadius - 5, centerY);
        }
    }, [displayScale, targetAltitudeKm, centerX, centerY, canvasSize.width]);
    
    const drawTrajectory = useCallback(() => {
        if (!ctxRef.current || !launched || simTimeS < 0.1) return;
        const ctx = ctxRef.current;

        const currentAltitudeDisplay = calculateCurrentAltitudeKm(rocketPosKm) - EARTH_RADIUS_KM;
        const trajectoryPoints = [];
        const rocketScreenX = centerX + rocketPosKm.x * displayScale;
        const rocketScreenY = centerY - rocketPosKm.y * displayScale;
        trajectoryPoints.push({ x: rocketScreenX, y: rocketScreenY });

        if (currentAltitudeDisplay >= 50) {
            let simPos = { ...rocketPosKm };
            let simVel = { ...rocketVelKmps };
            const steps = 360;
            const timeStep = (orbitalPeriodMin > 0 && orbitalPeriodMin < 1000) 
                ? orbitalPeriodMin * 60 / steps 
                : 10;

            for (let i = 0; i < steps; i++) {
                const r = calculateCurrentAltitudeKm(simPos);
                const gm = G_CONST * EARTH_MASS_KG;
                const acc = {
                    x: -simPos.x / r * gm / Math.pow(r * 1000, 2) / 1000,
                    y: -simPos.y / r * gm / Math.pow(r * 1000, 2) / 1000
                };
                simVel.x += acc.x * timeStep;
                simVel.y += acc.y * timeStep;
                simPos.x += simVel.x * timeStep;
                simPos.y += simVel.y * timeStep;

                trajectoryPoints.push({ 
                    x: centerX + simPos.x * displayScale, 
                    y: centerY - simPos.y * displayScale 
                });

                if (calculateCurrentAltitudeKm(simPos) < EARTH_RADIUS_KM) break;
                if (inOrbit && (i * timeStep) >= orbitalPeriodMin * 60) break;
            }
        }
        
        if (trajectoryPoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(trajectoryPoints[0].x, trajectoryPoints[0].y);
            for (let i = 1; i < trajectoryPoints.length; i++) {
                ctx.lineTo(trajectoryPoints[i].x, trajectoryPoints[i].y);
            }
            let alpha = (currentAltitudeDisplay < 50) ? 0.3 : 0.7;
            ctx.strokeStyle = `rgba(229, 231, 235, ${alpha})`; // Tailwind gray-200 with alpha
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }, [launched, simTimeS, rocketPosKm, rocketVelKmps, displayScale, centerX, centerY, orbitalPeriodMin, inOrbit, calculateCurrentAltitudeKm]);

    const drawRocket = useCallback(() => {
        if (!ctxRef.current || !launched || crashed) return;
        const ctx = ctxRef.current;
        const rocketScreenX = centerX + rocketPosKm.x * displayScale;
        const rocketScreenY = centerY - rocketPosKm.y * displayScale;

        let displayAngleRad;
        const currentSpeed = Math.sqrt(rocketVelKmps.x**2 + rocketVelKmps.y**2);
        if (currentSpeed > 0.01) {
            displayAngleRad = Math.atan2(rocketVelKmps.y, rocketVelKmps.x);
        } else {
            displayAngleRad = (initialLaunchAngleDeg) * Math.PI / 180;
        }

        ctx.save();
        ctx.translate(rocketScreenX, rocketScreenY);
        ctx.rotate(displayAngleRad);

        const rSize = Math.max(5, 20 * Math.min(1, displayScale * 5));
        ctx.fillStyle = '#e5e7eb'; // Tailwind gray-200
        ctx.beginPath();
        ctx.moveTo(rSize * 0.75, 0);
        ctx.lineTo(-rSize * 0.75, -rSize * 0.25);
        ctx.lineTo(-rSize * 0.5, 0);
        ctx.lineTo(-rSize * 0.75, rSize * 0.25);
        ctx.closePath();
        ctx.fill();

        if (fuelRemainingTons > 0 && currentThrustOutputKn > 0) {
            const flameLength = rSize * (1 + Math.sin(simTimeS * 20) * 0.25);
            const flameGradient = ctx.createLinearGradient(-rSize * 0.5, 0, -rSize*0.5 - flameLength, 0);
            flameGradient.addColorStop(0, '#f97316'); // Tailwind orange-500
            flameGradient.addColorStop(0.5, '#ea580c'); // Tailwind orange-600
            flameGradient.addColorStop(1, 'rgba(234, 88, 12, 0)');
            
            ctx.fillStyle = flameGradient;
            ctx.beginPath();
            ctx.moveTo(-rSize * 0.5, 0);
            ctx.lineTo(-rSize * 0.75, -rSize * 0.15);
            ctx.lineTo(-rSize * 0.5 - flameLength, 0);
            ctx.lineTo(-rSize * 0.75, rSize * 0.15);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }, [launched, crashed, rocketPosKm, rocketVelKmps, displayScale, centerX, centerY, fuelRemainingTons, simTimeS, currentThrustOutputKn, initialLaunchAngleDeg]);

    const drawScene = useCallback(() => {
        if (!ctxRef.current) return;
        const ctx = ctxRef.current;
        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
        ctx.fillStyle = '#111827'; // Tailwind gray-900
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

        drawStars();
        drawEarth();
        drawTargetOrbit();
        drawTrajectory();
        drawRocket();
    }, [canvasSize, drawStars, drawEarth, drawTargetOrbit, drawTrajectory, drawRocket]);

    useEffect(() => {
        drawScene();
    }, [drawScene, rocketPosKm]);

    // Simulation Logic & Animation Loop (Same as before)
    const calculateOrbitalParameters = useCallback(() => {
      const r_km = calculateCurrentAltitudeKm(rocketPosKm); 
      const v_kmps = Math.sqrt(rocketVelKmps.x ** 2 + rocketVelKmps.y ** 2);
      setOrbitalVelocityKmps(v_kmps);
      const mu_m3_s2 = G_CONST * EARTH_MASS_KG;
      const r_m = r_km * 1000;
      const v_mps = v_kmps * 1000;
      const specificEnergy_J_kg = (v_mps * v_mps) / 2 - mu_m3_s2 / r_m;
  
      if (specificEnergy_J_kg >= 0) {
          setApogeeKm(Infinity);
          setPerigeeKm(Math.max(0, r_km - EARTH_RADIUS_KM));
          setOrbitalPeriodMin(Infinity);
          return;
      }
      const semiMajorAxis_m = -mu_m3_s2 / (2 * specificEnergy_J_kg);
      const a_km = semiMajorAxis_m / 1000;
      const h_vec_z_m2_s = (rocketPosKm.x*1000 * rocketVelKmps.y*1000) - (rocketPosKm.y*1000 * rocketVelKmps.x*1000);
      const eccentricity = Math.sqrt(1 + (2 * specificEnergy_J_kg * h_vec_z_m2_s * h_vec_z_m2_s) / (mu_m3_s2 * mu_m3_s2));
      let apo_km = a_km * (1 + eccentricity) - EARTH_RADIUS_KM;
      let peri_km = a_km * (1 - eccentricity) - EARTH_RADIUS_KM;
      setApogeeKm(Math.min(10000, apo_km < 0 ? 0 : apo_km));
      setPerigeeKm(Math.max(0, peri_km));
      const period_s = 2 * Math.PI * Math.sqrt(Math.pow(a_km * 1000, 3) / mu_m3_s2);
      setOrbitalPeriodMin(Math.min(1000, period_s / 60));
    }, [rocketPosKm, rocketVelKmps, calculateCurrentAltitudeKm]);

    const updateSimulation = useCallback((dt) => {
        if (!launched || crashed || inOrbit) return;
        let newSimTimeS = simTimeS + dt;
        setSimTimeS(newSimTimeS);
        let currentDryMassTons = currentStage === 1 ? ROCKET_DRY_MASS_TONS_STAGE1 : ROCKET_DRY_MASS_TONS_STAGE2;
        if (currentStage === 1 && newSimTimeS >= stageTimingSeconds) {
            setCurrentStage(2);
            currentDryMassTons = ROCKET_DRY_MASS_TONS_STAGE2;
            setStageIndicatorText("Stage 2");
            addMessage(`T+${newSimTimeS.toFixed(1)}s: Stage separation!`);
        }
        let newFuelRemainingTons = fuelRemainingTons;
        if (newFuelRemainingTons > 0) {
            newFuelRemainingTons -= burnRateTps * dt;
            if (newFuelRemainingTons < 0) newFuelRemainingTons = 0;
            setFuelRemainingTons(newFuelRemainingTons);
        }
        const totalMassKg = (currentDryMassTons + newFuelRemainingTons) * 1000;
        setCurrentMassTons(totalMassKg / 1000);
        let thrustForceN = { x: 0, y: 0 };
        let currentThrustKn = 0;
        if (newFuelRemainingTons > 0) {
            currentThrustKn = thrustKn;
            const thrustMagnitudeN = thrustKn * 1000;
            let currentRocketOrientationDeg = initialLaunchAngleDeg;
            const altKm = calculateCurrentAltitudeKm(rocketPosKm) - EARTH_RADIUS_KM;
            if (altKm > 10) { 
                currentRocketOrientationDeg = Math.max(0, initialLaunchAngleDeg - (altKm / 5));
            }
            const currentSpeed = Math.sqrt(rocketVelKmps.x**2 + rocketVelKmps.y**2);
            if (currentSpeed > 1) {
                 currentRocketOrientationDeg = Math.atan2(rocketVelKmps.y, rocketVelKmps.x) * 180 / Math.PI;
            }
            const angleRad = currentRocketOrientationDeg * Math.PI / 180;
            thrustForceN.x = thrustMagnitudeN * Math.cos(angleRad);
            thrustForceN.y = thrustMagnitudeN * Math.sin(angleRad);
        }
        setCurrentThrustOutputKn(currentThrustKn);
        setAngleDeg(Math.atan2(rocketVelKmps.y, rocketVelKmps.x) * 180 / Math.PI);
        const distCenterKm = calculateCurrentAltitudeKm(rocketPosKm);
        const distCenterM = distCenterKm * 1000;
        const gravityMagN = (G_CONST * EARTH_MASS_KG * totalMassKg) / (distCenterM * distCenterM);
        const gravityForceN = {
            x: -rocketPosKm.x / distCenterKm * gravityMagN,
            y: -rocketPosKm.y / distCenterKm * gravityMagN
        };
        let dragForceN = { x: 0, y: 0 };
        const currentAltitudeKm = distCenterKm - EARTH_RADIUS_KM;
        setAltitudeKm(currentAltitudeKm);
        if (currentAltitudeKm < 100) {
            const DRAG_COEFF = 0.5;
            const ROCKET_AREA_M2 = 10;
            const airDensityKgM3 = 1.225 * Math.exp(-currentAltitudeKm / (atmosphereDensityMultiplier === 0 ? 0.001 : 7)) * atmosphereDensityMultiplier;
            const speedMps = Math.sqrt(rocketVelKmps.x**2 + rocketVelKmps.y**2) * 1000;
            const dragMagN = 0.5 * DRAG_COEFF * airDensityKgM3 * ROCKET_AREA_M2 * speedMps * speedMps;
            if (speedMps > 0) {
                dragForceN.x = -rocketVelKmps.x / (speedMps/1000) * dragMagN;
                dragForceN.y = -rocketVelKmps.y / (speedMps/1000) * dragMagN;
            }
        }
        const netForceN = {
            x: thrustForceN.x + gravityForceN.x + dragForceN.x,
            y: thrustForceN.y + gravityForceN.y + dragForceN.y
        };
        const newAccelMps2 = {
            x: netForceN.x / totalMassKg,
            y: netForceN.y / totalMassKg
        };
        setRocketAccelMps2(newAccelMps2);
        setAccelerationMps2(Math.sqrt(newAccelMps2.x**2 + newAccelMps2.y**2));
        const newVelKmps = {
            x: rocketVelKmps.x + newAccelMps2.x * dt / 1000,
            y: rocketVelKmps.y + newAccelMps2.y * dt / 1000
        };
        setRocketVelKmps(newVelKmps);
        setVelocityKmps(Math.sqrt(newVelKmps.x**2 + newVelKmps.y**2));
        const newPosKm = {
            x: rocketPosKm.x + newVelKmps.x * dt,
            y: rocketPosKm.y + newVelKmps.y * dt
        };
        setRocketPosKm(newPosKm);
        calculateOrbitalParameters();
        if (!achievements.reachedSpace && currentAltitudeKm >= SPACE_BOUNDARY_KM) {
            setAchievements(prev => ({ ...prev, reachedSpace: true }));
            addMessage(`T+${newSimTimeS.toFixed(1)}s: Crossed Kármán line! Space at ${SPACE_BOUNDARY_KM} km.`);
            showAchievement("Space Achieved!");
            setMissionStatusText("Space reached! Continuing to target orbit...");
        }
        if (!achievements.reachedOrbit && currentAltitudeKm >= LOW_EARTH_ORBIT_MIN_KM && perigeeKm > (SPACE_BOUNDARY_KM - 10) && currentAltitudeKm < LOW_EARTH_ORBIT_MAX_KM ) {
            const requiredOrbitalVel = Math.sqrt(G_CONST * EARTH_MASS_KG / ((EARTH_RADIUS_KM + currentAltitudeKm)*1000)) / 1000;
            if (Math.abs(velocityKmps - requiredOrbitalVel) < requiredOrbitalVel * 0.2 && perigeeKm > SPACE_BOUNDARY_KM * 0.8) {
                setAchievements(prev => ({ ...prev, reachedOrbit: true }));
                setInOrbit(true);
                addMessage(`T+${newSimTimeS.toFixed(1)}s: Stable orbit at ${currentAltitudeKm.toFixed(1)} km!`);
                showAchievement("Orbit Achieved!");
                setMissionStatusText("Stable orbit! Mission successful.");
                if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
                if (Math.abs(currentAltitudeKm - targetAltitudeKm) < 20 && Math.abs(perigeeKm - targetAltitudeKm) < 50) {
                     setAchievements(prev => ({ ...prev, completedMission: true }));
                     addMessage(`Mission complete! Target altitude ${targetAltitudeKm} km reached.`);
                     showAchievement("Mission Complete!");
                }
            }
        }
        if (currentAltitudeKm < 0 && newSimTimeS > 1) {
            setCrashed(true);
            addMessage(`T+${newSimTimeS.toFixed(1)}s: Mission failed. Impact. Max alt: ${apogeeKm.toFixed(1)} km.`);
            setMissionStatusText("Mission failed! Rocket crashed.");
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
        }
        if (newFuelRemainingTons <= 0 && !inOrbit && !crashed && currentThrustOutputKn > 0) { // only log once
             addMessage(`T+${newSimTimeS.toFixed(1)}s: All fuel expended.`);
        }
    }, [
        launched, crashed, inOrbit, simTimeS, currentStage, stageTimingSeconds, fuelRemainingTons, burnRateTps, thrustKn,
        rocketPosKm, rocketVelKmps, initialLaunchAngleDeg, atmosphereDensityMultiplier, achievements, 
        targetAltitudeKm, addMessage, showAchievement, calculateCurrentAltitudeKm, calculateOrbitalParameters,
        fuelCapacityTons, perigeeKm, velocityKmps, currentThrustOutputKn // Added currentThrustOutputKn
    ]);
    
    useEffect(() => {
        if (launched && !crashed && !inOrbit) {
            let lastTime = performance.now();
            const animate = (currentTime) => {
                const deltaTime = (currentTime - lastTime) / 1000;
                lastTime = currentTime;
                updateSimulation(Math.min(deltaTime, 0.1));
                animationIdRef.current = requestAnimationFrame(animate);
            };
            animationIdRef.current = requestAnimationFrame(animate);
        } else {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
                animationIdRef.current = null;
            }
        }
        return () => {
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
        };
    }, [launched, crashed, inOrbit, updateSimulation]);

    // Event Handlers (Same logic)
    const handleLaunch = () => {
        setLaunched(true); setCrashed(false); setInOrbit(false); setSimTimeS(0);
        setFuelRemainingTons(fuelCapacityTons); setCurrentStage(1);
        setRocketPosKm({ x: 0, y: EARTH_RADIUS_KM }); setRocketVelKmps({ x: 0, y: 0 });
        setRocketAccelMps2({ x: 0, y: 0 });
        setAchievements({ reachedSpace: false, reachedOrbit: false, completedMission: false });
        setStageIndicatorText("Stage 1"); setMissionStatusText("Liftoff! Monitoring...");
        addMessage("Launch sequence initiated. T+0s: Liftoff!");
        setAngleDeg(initialLaunchAngleDeg);
    };
    const handleAbort = () => {
        setLaunched(false);
        setMissionStatusText("Mission aborted."); setStageIndicatorText("Aborted");
        addMessage(`Abort at T+${simTimeS.toFixed(1)}s.`);
        if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
    };


    // --- JSX with Tailwind CSS ---
    return (
        <div className="max-w-screen-xl mx-auto p-4 md:p-6 my-6 bg-gray-800 rounded-xl shadow-2xl text-gray-200">
            <h1 className="text-3xl font-bold text-blue-400 text-center mb-8">Rocket Launch & Orbital Simulator</h1>
            
            <div className="flex flex-col gap-6">
                {/* Canvas Area */}
                <div ref={canvasContainerRef} className="relative w-full h-[500px] md:h-[600px] border-2 border-gray-700 rounded-lg overflow-hidden bg-gray-900">
                    <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
                    <div className="absolute top-3 left-3 px-3 py-1.5 bg-gray-700/80 backdrop-blur-sm rounded text-sm shadow-md">{stageIndicatorText}</div>
                    <div 
                        className={`absolute top-3 right-3 px-3 py-1.5 bg-green-600/80 backdrop-blur-sm rounded text-white text-sm shadow-md transition-opacity duration-500 ${achievementVisible ? 'opacity-100' : 'opacity-0'}`}
                    >
                        {achievementText}
                    </div>
                    <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-gray-700/80 backdrop-blur-sm rounded text-sm shadow-md max-w-[250px]">{missionStatusText}</div>
                </div>
                
                {/* Control Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 md:p-6 bg-gray-700 rounded-lg">
                    {/* Rocket Configuration */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-xl font-semibold text-blue-400 border-b border-gray-600 pb-2">Rocket Configuration</h3>
                        <ControlItem label="Thrust Power">
                            <input type="range" className="w-full h-2 bg-gray-600 rounded-md appearance-none cursor-pointer custom-slider" min="1000" max="10000" value={thrustKn} step="100" 
                                   onChange={(e) => setThrustKn(Number(e.target.value))} disabled={disableControls} />
                            <ValueDisplay val={thrustKn} unit="kN" />
                        </ControlItem>
                        <ControlItem label="Fuel Capacity">
                            <input type="range" className="w-full h-2 bg-gray-600 rounded-md appearance-none cursor-pointer custom-slider" min="100" max="500" value={fuelCapacityTons} step="10"
                                   onChange={(e) => setFuelCapacityTons(Number(e.target.value))} disabled={disableControls} />
                            <ValueDisplay val={fuelCapacityTons} unit="tons" />
                        </ControlItem>
                        <ControlItem label="Fuel Burn Rate">
                            <input type="range" className="w-full h-2 bg-gray-600 rounded-md appearance-none cursor-pointer custom-slider" min="10" max="50" value={burnRateTps} step="1"
                                   onChange={(e) => setBurnRateTps(Number(e.target.value))} disabled={disableControls} />
                            <ValueDisplay val={burnRateTps} unit="t/s" />
                        </ControlItem>
                    </div>
                    
                    {/* Launch Parameters */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-xl font-semibold text-blue-400 border-b border-gray-600 pb-2">Launch Parameters</h3>
                        <ControlItem label="Initial Launch Angle">
                            <input type="range" className="w-full h-2 bg-gray-600 rounded-md appearance-none cursor-pointer custom-slider" min="80" max="90" value={initialLaunchAngleDeg} step="0.1"
                                   onChange={(e) => setInitialLaunchAngleDeg(Number(e.target.value))} disabled={disableControls} />
                            <ValueDisplay val={initialLaunchAngleDeg.toFixed(1)} unit="°" />
                        </ControlItem>
                        <ControlItem label="Ref. Surface Gravity">
                            <input type="range" className="w-full h-2 bg-gray-600 rounded-md appearance-none cursor-pointer custom-slider" min="5" max="15" value={gravityMps2} step="0.1"
                                   onChange={(e) => setGravityMps2(Number(e.target.value))} disabled={disableControls} />
                            <ValueDisplay val={gravityMps2.toFixed(1)} unit="m/s²" />
                        </ControlItem>
                         <ControlItem label="Atmosphere Density X">
                            <input type="range" className="w-full h-2 bg-gray-600 rounded-md appearance-none cursor-pointer custom-slider" min="0.0" max="2" value={atmosphereDensityMultiplier} step="0.1"
                                   onChange={(e) => setAtmosphereDensityMultiplier(Number(e.target.value))} disabled={disableControls} />
                            <ValueDisplay val={atmosphereDensityMultiplier.toFixed(1)} unit="x" />
                        </ControlItem>
                    </div>
                    
                    {/* Mission Control */}
                    <div className="flex flex-col gap-4 md:col-span-2 lg:col-span-1">
                        <h3 className="text-xl font-semibold text-blue-400 border-b border-gray-600 pb-2">Mission Control</h3>
                        <div className="flex gap-3">
                            <button className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed" onClick={handleLaunch} disabled={launched && !crashed && !inOrbit}>Launch</button>
                            <button className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed" onClick={handleAbort} disabled={!launched || crashed || inOrbit}>Abort</button>
                        </div>
                        <ControlItem label="Target Orbital Altitude">
                            <input type="range" className="w-full h-2 bg-gray-600 rounded-md appearance-none cursor-pointer custom-slider" min="100" max="1000" value={targetAltitudeKm} step="10"
                                   onChange={(e) => setTargetAltitudeKm(Number(e.target.value))} disabled={disableControls} />
                            <ValueDisplay val={targetAltitudeKm} unit="km" />
                        </ControlItem>
                        <ControlItem label="Stage Separation Timing">
                            <input type="range" className="w-full h-2 bg-gray-600 rounded-md appearance-none cursor-pointer custom-slider" min="60" max="180" value={stageTimingSeconds} step="5"
                                   onChange={(e) => setStageTimingSeconds(Number(e.target.value))} disabled={disableControls} />
                            <ValueDisplay val={stageTimingSeconds} unit="s" />
                        </ControlItem>
                    </div>
                </div>
                
                {/* Data Panels */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <DataSection title="Flight Data">
                        <DataItem label="Altitude" value={`${altitudeKm.toFixed(2)} km`} />
                        <DataItem label="Velocity" value={`${velocityKmps.toFixed(2)} km/s`} />
                        <DataItem label="Acceleration" value={`${accelerationMps2.toFixed(2)} m/s²`} />
                        <DataItem label="Flight Angle" value={`${angleDeg.toFixed(1)}°`} />
                    </DataSection>
                    <DataSection title="Rocket Status">
                        <DataItem label="Fuel Remaining" value={`${(fuelRemainingTons / fuelCapacityTons * 100).toFixed(1)}%`} />
                        <DataItem label="Current Stage" value={currentStage} />
                        <DataItem label="Mass" value={`${currentMassTons.toFixed(2)} t`} />
                        <DataItem label="Thrust Output" value={`${currentThrustOutputKn.toFixed(2)} kN`} />
                    </DataSection>
                    <DataSection title="Orbital Parameters">
                        <DataItem label="Apogee" value={`${isFinite(apogeeKm) ? apogeeKm.toFixed(2) : '∞'} km`} />
                        <DataItem label="Perigee" value={`${isFinite(perigeeKm) ? perigeeKm.toFixed(2) : 'N/A'} km`} />
                        <DataItem label="Orbital Period" value={`${isFinite(orbitalPeriodMin) ? orbitalPeriodMin.toFixed(2) : '∞'} min`} />
                        <DataItem label="Orbital Velocity" value={`${orbitalVelocityKmps.toFixed(2)} km/s`} />
                    </DataSection>
                </div>
                
                {/* Message Log */}
                <div className="mt-2 p-4 bg-gray-700 rounded-lg border-l-4 border-blue-400">
                    <div className="text-lg font-semibold text-blue-400 mb-2">Mission Log (Last {messages.length})</div>
                    <div className="text-sm text-gray-300 max-h-40 overflow-y-auto space-y-1 leading-relaxed" 
                         dangerouslySetInnerHTML={{ __html: messages.join("<br />") }}>
                    </div>
                </div>
                
                {/* Physics Info */}
                <div className="mt-2 p-4 bg-gray-700 rounded-lg border-l-4 border-green-600">
                    <h3 className="text-lg font-semibold text-green-500 mb-2">Orbital Mechanics</h3>
                    <p className="text-sm text-gray-300 mb-3">This simulator models rocket launches and orbital mechanics using key equations:</p>
                    <div className="font-mono bg-gray-600 p-3 rounded-md my-2 overflow-x-auto text-sm">F_net = F_thrust + F_gravity + F_drag = m × a</div>
                    <div className="font-mono bg-gray-600 p-3 rounded-md my-2 overflow-x-auto text-sm">Δv = v_e × ln(m_0 / m_f)    (Tsiolkovsky)</div>
                    <div className="font-mono bg-gray-600 p-3 rounded-md my-2 overflow-x-auto text-sm">v_orbit ≈ √(G × M_Earth / r)    (Circular Orbit)</div>
                    <div className="font-mono bg-gray-600 p-3 rounded-md my-2 overflow-x-auto text-sm">T = 2π × √(r³ / (G × M_Earth))    (Orbital Period)</div>
                    <p className="text-sm text-gray-300 mt-3 mb-1">Where (approximate values):</p>
                    <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                        <li>F = force, m = mass, a = acceleration, Δv = delta-v</li>
                        <li>v_e = exhaust velocity (~{EXHAUST_VELOCITY_MPS} m/s)</li>
                        <li>m_0 = initial mass, m_f = final mass</li>
                        <li>G = Gravitational Constant ({G_CONST.toExponential(3)})</li>
                        <li>M_Earth = Mass of Earth (~{EARTH_MASS_KG.toExponential(3)} kg)</li>
                        <li>r = orbital radius (from Earth's center)</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

// Helper components for Tailwind structure
const ControlItem = ({ label, children }) => (
    <div>
        <label className="block text-sm text-gray-400 mb-1">{label}</label>
        <div className="flex items-center gap-3">
            {children}
        </div>
    </div>
);

const ValueDisplay = ({ val, unit }) => (
    <>
        <span className="font-mono text-sm text-gray-100 min-w-[45px] text-right">{val}</span>
        <span className="text-xs text-gray-400">{unit}</span>
    </>
);

const DataSection = ({ title, children }) => (
    <div className="p-4 bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-400 border-b border-gray-600 pb-2 mb-3">{title}</h3>
        <div className="grid grid-cols-2 gap-3">
            {children}
        </div>
    </div>
);

const DataItem = ({ label, value }) => (
    <div className="p-3 bg-gray-600 rounded-md">
        <div className="text-xs text-gray-400 mb-0.5">{label}</div>
        <div className="text-base md:text-lg font-bold font-mono text-gray-100">{value}</div>
    </div>
);

export default RocketSimulator;