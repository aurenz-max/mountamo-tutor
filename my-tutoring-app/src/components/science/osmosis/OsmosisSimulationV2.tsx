'use client';

// components/OsmosisSimulationV2.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './OsmosisSimulationV2.module.css'; // New CSS module

// --- Configuration ---
const ENV_WIDTH = 350; // SVG viewbox width
const ENV_HEIGHT = 300; // SVG viewbox height
const INITIAL_CELL_RADIUS = 50;
const MIN_CELL_RADIUS = 15;
const MAX_CELL_RADIUS = 100; // Keep it within ENV_HEIGHT/2 roughly
const WATER_RADIUS = 2.5;
const SOLUTE_RADIUS = 5;
const WATER_COLOR = '#64b5f6'; // Lighter blue
const SOLUTE_COLOR = '#ffb74d'; // Lighter orange
const MEMBRANE_COLOR = '#ff8a65'; // A distinct color for the cell membrane

const SIMULATION_SPEED = 60; // ms per frame (adjust for performance/smoothness)
const SENSITIVITY_FACTOR = 0.15; // Controls how fast the cell size changes
const PARTICLE_JIGGLE_AMOUNT = 1; // Pixels per frame max jiggle
const WATER_PARTICLES_PER_AREA = 0.008; // Adjust density
const SOLUTE_PARTICLES_PER_CONCENTRATION_UNIT = 1; // How many solute particles per slider unit

// --- Helper Functions ---
const getRandomPointInCircle = (cx, cy, r) => {
  const angle = Math.random() * 2 * Math.PI;
  // Bias points towards center slightly for better distribution visually
  const radius = Math.sqrt(Math.random()) * r;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
};

const getRandomPointInRectExcludingCircle = (rectW, rectH, circleCx, circleCy, circleR) => {
  let x, y;
  do {
    x = Math.random() * rectW;
    y = Math.random() * rectH;
  } while (Math.sqrt((x - circleCx)**2 + (y - circleCy)**2) <= circleR); // Ensure outside circle
  return { x, y };
};

const isInsideCircle = (x, y, cx, cy, r) => {
    return Math.sqrt((x - cx)**2 + (y - cy)**2) < r;
}

// --- Component ---
function OsmosisSimulationV2() {
  const [concentrationInside, setConcentrationInside] = useState(10);
  const [concentrationOutside, setConcentrationOutside] = useState(10);
  const [cellRadius, setCellRadius] = useState(INITIAL_CELL_RADIUS);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('Isotonic');
  const [particles, setParticles] = useState([]); // { id, x, y, type: 'water' | 'solute', location: 'inside' | 'outside' }

  const intervalRef = useRef(null);
  const particleIdCounter = useRef(0);
  const environmentCenter = { x: ENV_WIDTH / 2, y: ENV_HEIGHT / 2 };

  // --- Particle Generation ---
  const generateParticles = useCallback((insideConc, outsideConc, radius) => {
      particleIdCounter.current = 0; // Reset ID counter
      const newParticles = [];
      const cellCenterX = environmentCenter.x;
      const cellCenterY = environmentCenter.y;

      // Calculate number of particles based on area/concentration
      const cellArea = Math.PI * radius**2;
      const environmentArea = (ENV_WIDTH * ENV_HEIGHT) - cellArea;

      const numWaterInside = Math.floor(cellArea * WATER_PARTICLES_PER_AREA);
      const numSoluteInside = Math.floor(insideConc * SOLUTE_PARTICLES_PER_CONCENTRATION_UNIT);

      const numWaterOutside = Math.floor(environmentArea * WATER_PARTICLES_PER_AREA);
      const numSoluteOutside = Math.floor(outsideConc * SOLUTE_PARTICLES_PER_CONCENTRATION_UNIT);

      // Create inside particles
      for (let i = 0; i < numWaterInside; i++) {
          const { x, y } = getRandomPointInCircle(cellCenterX, cellCenterY, radius - WATER_RADIUS);
          newParticles.push({ id: particleIdCounter.current++, x, y, type: 'water', location: 'inside' });
      }
      for (let i = 0; i < numSoluteInside; i++) {
          const { x, y } = getRandomPointInCircle(cellCenterX, cellCenterY, radius - SOLUTE_RADIUS);
          newParticles.push({ id: particleIdCounter.current++, x, y, type: 'solute', location: 'inside' });
      }

      // Create outside particles
       for (let i = 0; i < numWaterOutside; i++) {
           const { x, y } = getRandomPointInRectExcludingCircle(ENV_WIDTH, ENV_HEIGHT, cellCenterX, cellCenterY, radius + WATER_RADIUS);
           newParticles.push({ id: particleIdCounter.current++, x, y, type: 'water', location: 'outside' });
       }
       for (let i = 0; i < numSoluteOutside; i++) {
           const { x, y } = getRandomPointInRectExcludingCircle(ENV_WIDTH, ENV_HEIGHT, cellCenterX, cellCenterY, radius + SOLUTE_RADIUS);
           newParticles.push({ id: particleIdCounter.current++, x, y, type: 'solute', location: 'outside' });
       }

      setParticles(newParticles);

  }, [environmentCenter.x, environmentCenter.y]);


  // --- Determine Status ---
   const determineStatus = useCallback((outside, inside) => {
    if (outside > inside) return 'Hypertonic (Water Exits)';
    if (outside < inside) return 'Hypotonic (Water Enters)';
    return 'Isotonic (Equilibrium)';
  }, []);

  // --- Update Status on Concentration Change ---
  useEffect(() => {
    setStatus(determineStatus(concentrationOutside, concentrationInside));
    // Regenerate particles only when not running and concentrations change
    if (!isRunning) {
      generateParticles(concentrationInside, concentrationOutside, cellRadius);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concentrationInside, concentrationOutside, determineStatus, generateParticles, isRunning]); // Rerun if conc changes OR if stopping

   // Initial particle generation on mount
  useEffect(() => {
    generateParticles(concentrationInside, concentrationOutside, cellRadius);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  // --- Simulation Loop ---
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        // --- 1. Calculate Cell Size Change ---
        let newRadius = cellRadius;
        const concentrationDifference = concentrationInside - concentrationOutside;
        // If inside is higher conc (hypotonic env), water moves IN -> radius increases. Diff > 0.
        // If outside is higher conc (hypertonic env), water moves OUT -> radius decreases. Diff < 0.
        const radiusChange = concentrationDifference * SENSITIVITY_FACTOR * (SIMULATION_SPEED / 1000); // Scale change by time step

        newRadius += radiusChange;
        newRadius = Math.max(MIN_CELL_RADIUS, Math.min(MAX_CELL_RADIUS, newRadius));

        // --- 2. Update Particle Positions (Jiggle & Osmosis) ---
        setParticles(prevParticles => {
            const updatedParticles = prevParticles.map(p => {
                // Copy particle to avoid mutation
                const newP = { ...p };

                // --- Apply Jiggle ---
                newP.x += (Math.random() - 0.5) * 2 * PARTICLE_JIGGLE_AMOUNT;
                newP.y += (Math.random() - 0.5) * 2 * PARTICLE_JIGGLE_AMOUNT;

                // --- Boundary Checks ---
                const particleRadius = p.type === 'water' ? WATER_RADIUS : SOLUTE_RADIUS;
                const isCurrentlyInside = isInsideCircle(p.x, p.y, environmentCenter.x, environmentCenter.y, cellRadius); // Check against OLD radius for current position

                if (newP.location === 'inside') {
                    // Keep inside cell or move out if water & hypertonic
                    const distFromCenter = Math.sqrt((newP.x - environmentCenter.x)**2 + (newP.y - environmentCenter.y)**2);

                    if (distFromCenter > newRadius - particleRadius) { // Hit the membrane (use newRadius for target state)
                        if (p.type === 'water' && concentrationDifference < 0 && Math.random() < 0.1) { // Hypertonic: Water moves OUT (small chance per frame)
                            newP.location = 'outside';
                            // Nudge particle just outside the new radius
                            const angle = Math.atan2(newP.y - environmentCenter.y, newP.x - environmentCenter.x);
                            newP.x = environmentCenter.x + (newRadius + particleRadius * 2) * Math.cos(angle);
                            newP.y = environmentCenter.y + (newRadius + particleRadius * 2) * Math.sin(angle);
                        } else {
                            // Bounce back if solute or wrong conditions for water movement
                            const angle = Math.atan2(p.y - environmentCenter.y, p.x - environmentCenter.x);
                            newP.x = environmentCenter.x + (newRadius - particleRadius) * Math.cos(angle);
                            newP.y = environmentCenter.y + (newRadius - particleRadius) * Math.sin(angle);
                        }
                    }
                } else { // location === 'outside'
                    // Keep outside environment boundaries or move in if water & hypotonic
                    newP.x = Math.max(particleRadius, Math.min(ENV_WIDTH - particleRadius, newP.x));
                    newP.y = Math.max(particleRadius, Math.min(ENV_HEIGHT - particleRadius, newP.y));

                    const distFromCenter = Math.sqrt((newP.x - environmentCenter.x)**2 + (newP.y - environmentCenter.y)**2);

                     if (distFromCenter < newRadius + particleRadius && distFromCenter > newRadius - particleRadius*2) { // Near membrane from outside
                         if (p.type === 'water' && concentrationDifference > 0 && Math.random() < 0.1) { // Hypotonic: Water moves IN (small chance per frame)
                             newP.location = 'inside';
                             // Nudge particle just inside the new radius
                              const angle = Math.atan2(newP.y - environmentCenter.y, newP.x - environmentCenter.x);
                             newP.x = environmentCenter.x + (newRadius - particleRadius * 2) * Math.cos(angle);
                             newP.y = environmentCenter.y + (newRadius - particleRadius * 2) * Math.sin(angle);
                         } else if (distFromCenter < newRadius + particleRadius) {
                             // Bounce off membrane if solute or wrong conditions for water
                             const angle = Math.atan2(p.y - environmentCenter.y, p.x - environmentCenter.x);
                             newP.x = environmentCenter.x + (newRadius + particleRadius) * Math.cos(angle);
                             newP.y = environmentCenter.y + (newRadius + particleRadius) * Math.sin(angle);
                         }
                     }
                }

                return newP;
            });

            // Filter out particles that might have escaped bounds (shouldn't happen often with checks)
            return updatedParticles.filter(p => p.x >= 0 && p.x <= ENV_WIDTH && p.y >= 0 && p.y <= ENV_HEIGHT);
        });


        // --- 3. Update Cell Radius State ---
        setCellRadius(newRadius);

        // --- 4. Check Stop Condition ---
         // Stop if size change is negligible or bounds are hit
         if ((Math.abs(radiusChange) < 0.01 && Math.abs(concentrationDifference) > 0) || newRadius === MIN_CELL_RADIUS || newRadius === MAX_CELL_RADIUS) {
            // Small delay before stopping allows final state to render
             // Check if concentration difference is actually zero for isotonic stop
             if (Math.abs(concentrationDifference) === 0) {
                 console.log("Stopping: Isotonic Equilibrium Reached");
                 handleStop();
             } else if (Math.abs(radiusChange) < 0.01) {
                 console.log("Stopping: Osmotic Equilibrium Reached (minimal change)");
                 handleStop();
             } else if (newRadius === MIN_CELL_RADIUS || newRadius === MAX_CELL_RADIUS) {
                 console.log("Stopping: Cell size limit reached");
                 handleStop();
             }
         }

      }, SIMULATION_SPEED);
    } else {
      clearInterval(intervalRef.current);
    }

    // Cleanup interval on unmount or when isRunning changes
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, concentrationInside, concentrationOutside, cellRadius, environmentCenter.x, environmentCenter.y]); // Dependencies for the simulation loop


  // --- Event Handlers ---
  const handleStart = () => {
    if (!isRunning) {
        setStatus(determineStatus(concentrationOutside, concentrationInside)); // Update status text
        setIsRunning(true);
    }
  };

  const handleStop = useCallback(() => { // useCallback needed if passed to useEffect indirectly
    setIsRunning(false);
    clearInterval(intervalRef.current);
    // Update status one last time after stopping
    setStatus(determineStatus(concentrationOutside, concentrationInside));
  }, [concentrationOutside, concentrationInside, determineStatus]);

  const handleReset = () => {
    handleStop();
    setConcentrationInside(10);
    setConcentrationOutside(10);
    const newRadius = INITIAL_CELL_RADIUS;
    setCellRadius(newRadius);
    generateParticles(10, 10, newRadius); // Regenerate with initial values
    setStatus('Isotonic');
  };

  const handleConcentrationChange = (setter) => (event) => {
     if(isRunning) return; // Prevent changes while running
    const value = parseInt(event.target.value, 10);
    setter(isNaN(value) ? 0 : value);
    // Note: Particles regenerate via the useEffect hook watching concentrations
  };


  return (
    <div className={styles.container}>
      <h2>Osmosis Simulation (Molecular View)</h2>
      <p className={styles.explanation}>
        Watch water (blue) move across the cell membrane (red circle) towards the higher solute (orange) concentration.
      </p>

       {/* Controls - Same structure as before */}
       <div className={styles.controls}>
        <div className={styles.sliderGroup}>
          <label htmlFor="insideConc">Solute Inside Cell: {concentrationInside}</label>
          <input
            type="range" id="insideConc" min="0" max="30" // Adjusted max based on particle count
            value={concentrationInside}
            onChange={handleConcentrationChange(setConcentrationInside)}
            disabled={isRunning} className={styles.slider}
          />
        </div>
        <div className={styles.sliderGroup}>
          <label htmlFor="outsideConc">Solute Outside Cell: {concentrationOutside}</label>
          <input
            type="range" id="outsideConc" min="0" max="30" // Adjusted max based on particle count
            value={concentrationOutside}
            onChange={handleConcentrationChange(setConcentrationOutside)}
            disabled={isRunning} className={styles.slider}
          />
        </div>
         <div className={styles.buttonGroup}>
          <button onClick={handleStart} disabled={isRunning} className={styles.button}>Start</button>
          <button onClick={handleStop} disabled={!isRunning} className={styles.button}>Stop</button>
          <button onClick={handleReset} className={styles.button}>Reset</button>
        </div>
      </div>

      <div className={styles.statusDisplay}>
        Environment: <strong>{status}</strong> | Cell Radius: {cellRadius.toFixed(1)}
      </div>

      {/* --- Simulation Area with SVG --- */}
      <div className={styles.simulationArea}>
        <svg
            viewBox={`0 0 ${ENV_WIDTH} ${ENV_HEIGHT}`}
            className={styles.environmentSvg}
            preserveAspectRatio="xMidYMid meet"
        >
            {/* Environment Background (optional) */}
            <rect x="0" y="0" width={ENV_WIDTH} height={ENV_HEIGHT} fill="#e0f7fa" />

            {/* Cell Membrane */}
            <circle
                cx={environmentCenter.x}
                cy={environmentCenter.y}
                r={cellRadius}
                fill="none"
                stroke={MEMBRANE_COLOR}
                strokeWidth="3"
                className={styles.cellMembrane} // For potential CSS animation hook
            />

             {/* Render Particles */}
            {particles.map(p => (
                 <circle
                    key={p.id}
                    cx={p.x}
                    cy={p.y}
                    r={p.type === 'water' ? WATER_RADIUS : SOLUTE_RADIUS}
                    fill={p.type === 'water' ? WATER_COLOR : SOLUTE_COLOR}
                    className={styles.particle} // For potential CSS animation hook
                 />
             ))}

             {/* Center Dot for reference (optional) */}
             {/* <circle cx={environmentCenter.x} cy={environmentCenter.y} r="2" fill="black" /> */}
        </svg>
      </div>
       <div className={styles.legend}>
            <span style={{ background: WATER_COLOR }}></span> Water
            <span style={{ background: SOLUTE_COLOR }}></span> Solute
            <span style={{ background: MEMBRANE_COLOR, height:'3px', width:'15px', display: 'inline-block', marginRight:'3px', verticalAlign:'middle' }}></span> Membrane
        </div>
    </div>
  );
}

export default OsmosisSimulationV2;