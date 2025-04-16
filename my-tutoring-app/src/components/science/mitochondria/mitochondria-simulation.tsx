import React, { useRef, useEffect, useState } from 'react';
import * as p5 from 'p5';

const MitochondriaSimulation = () => {
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let sketch = (p) => {
      // Constants
      const WIDTH = 600;
      const HEIGHT = 400;
      const OUTER_MEMBRANE_COLOR = '#FF9E80';
      const INNER_MEMBRANE_COLOR = '#FF6E40';
      const MATRIX_COLOR = '#FFCCBC';
      const GLUCOSE_COLOR = '#FFEB3B';
      const OXYGEN_COLOR = '#81D4FA';
      const ATP_COLOR = '#66BB6A';
      const CO2_COLOR = '#9E9E9E';
      const WATER_COLOR = '#29B6F6';
      const ELECTRON_COLOR = '#7986CB';
      
      // Particles arrays
      let glucose = [];
      let oxygen = [];
      let atp = [];
      let co2 = [];
      let water = [];
      let electrons = [];
      
      // Mitochondria shape
      let mitochondriaOuterX, mitochondriaOuterY, mitochondriaOuterWidth, mitochondriaOuterHeight;
      let cristae = [];
      
      p.setup = () => {
        p.createCanvas(WIDTH, HEIGHT);
        p.frameRate(60);
        p.noStroke();
        
        // Initialize mitochondria dimensions
        mitochondriaOuterX = WIDTH * 0.1;
        mitochondriaOuterY = HEIGHT * 0.15;
        mitochondriaOuterWidth = WIDTH * 0.8;
        mitochondriaOuterHeight = HEIGHT * 0.7;
        
        // Create cristae (inner membrane folds)
        const numCristae = 8;
        const cristaeSpacing = mitochondriaOuterWidth / (numCristae + 1);
        
        for (let i = 0; i < numCristae; i++) {
          const x = mitochondriaOuterX + cristaeSpacing * (i + 1);
          const height = p.random(mitochondriaOuterHeight * 0.3, mitochondriaOuterHeight * 0.7);
          const yStart = mitochondriaOuterY + (mitochondriaOuterHeight - height) / 2;
          cristae.push({
            x: x,
            yTop: yStart,
            yBottom: yStart + height,
            width: 10
          });
        }
        
        // Initial particles
        createInitialParticles();
      };
      
      p.draw = () => {
        if (!isPlaying) return;
        
        // Clear canvas
        p.background('#F5F5F5');
        
        // Draw mitochondria
        drawMitochondria();
        
        // Update and draw particles
        updateParticles();
        
        // Add new particles occasionally
        if (p.frameCount % Math.floor(60 / speed) === 0) {
          addNewGlucose();
          addNewOxygen();
        }
        
        // Display legend
        drawLegend();
      };
      
      function createInitialParticles() {
        // Add initial glucose molecules
        for (let i = 0; i < 3; i++) {
          const x = p.random(WIDTH * 0.05, WIDTH * 0.95);
          const y = p.random(HEIGHT * 0.05, HEIGHT * 0.95);
          glucose.push({
            x: x,
            y: y,
            vx: p.random(-0.5, 0.5) * speed,
            vy: p.random(-0.5, 0.5) * speed,
            size: 10,
            age: 0
          });
        }
        
        // Add initial oxygen molecules
        for (let i = 0; i < 6; i++) {
          const x = p.random(WIDTH * 0.05, WIDTH * 0.95);
          const y = p.random(HEIGHT * 0.05, HEIGHT * 0.95);
          oxygen.push({
            x: x,
            y: y,
            vx: p.random(-0.7, 0.7) * speed,
            vy: p.random(-0.7, 0.7) * speed,
            size: 8,
            age: 0
          });
        }
      }
      
      function addNewGlucose() {
        const x = p.random(WIDTH * 0.05, WIDTH * 0.95);
        const y = p.random(HEIGHT * 0.05, HEIGHT * 0.1);
        glucose.push({
          x: x,
          y: y,
          vx: p.random(-0.5, 0.5) * speed,
          vy: p.random(0.2, 0.7) * speed,
          size: 10,
          age: 0
        });
      }
      
      function addNewOxygen() {
        const x = p.random(WIDTH * 0.05, WIDTH * 0.95);
        const y = p.random(HEIGHT * 0.05, HEIGHT * 0.1);
        oxygen.push({
          x: x,
          y: y,
          vx: p.random(-0.7, 0.7) * speed,
          vy: p.random(0.3, 0.8) * speed,
          size: 8,
          age: 0
        });
      }
      
      function drawMitochondria() {
        // Draw outer membrane
        p.fill(OUTER_MEMBRANE_COLOR);
        p.rect(mitochondriaOuterX, mitochondriaOuterY, mitochondriaOuterWidth, mitochondriaOuterHeight, 20);
        
        // Draw matrix (inner area)
        p.fill(MATRIX_COLOR);
        p.rect(
          mitochondriaOuterX + 15, 
          mitochondriaOuterY + 15, 
          mitochondriaOuterWidth - 30, 
          mitochondriaOuterHeight - 30, 
          15
        );
        
        // Draw cristae (inner membrane folds)
        p.fill(INNER_MEMBRANE_COLOR);
        cristae.forEach(crista => {
          p.rect(crista.x - crista.width/2, crista.yTop, crista.width, crista.yBottom - crista.yTop, 5);
        });
      }
      
      function updateParticles() {
        // Update glucose
        updateGlucose();
        
        // Update oxygen
        updateOxygen();
        
        // Update ATP
        updateATP();
        
        // Update CO2
        updateCO2();
        
        // Update water
        updateWater();
        
        // Update electrons
        updateElectrons();
        
        // Check for reactions
        checkForReactions();
      }
      
      function updateGlucose() {
        for (let i = glucose.length - 1; i >= 0; i--) {
          const g = glucose[i];
          
          // Move
          g.x += g.vx * speed;
          g.y += g.vy * speed;
          
          // Bounce off walls
          if (g.x < 0 || g.x > WIDTH) g.vx *= -1;
          if (g.y < 0 || g.y > HEIGHT) g.vy *= -1;
          
          // Draw
          p.fill(GLUCOSE_COLOR);
          p.ellipse(g.x, g.y, g.size);
          
          // Add a C6H12O6 label
          p.fill(0);
          p.textSize(8);
          p.textAlign(p.CENTER, p.CENTER);
          p.text("C₆H₁₂O₆", g.x, g.y);
          
          // Age the particle
          g.age += speed;
          
          // Remove if too old (out of simulation bounds for too long)
          if (g.age > 500) {
            glucose.splice(i, 1);
          }
        }
      }
      
      function updateOxygen() {
        for (let i = oxygen.length - 1; i >= 0; i--) {
          const o = oxygen[i];
          
          // Move
          o.x += o.vx * speed;
          o.y += o.vy * speed;
          
          // Bounce off walls
          if (o.x < 0 || o.x > WIDTH) o.vx *= -1;
          if (o.y < 0 || o.y > HEIGHT) o.vy *= -1;
          
          // Draw
          p.fill(OXYGEN_COLOR);
          p.ellipse(o.x, o.y, o.size);
          
          // Add a O2 label
          p.fill(0);
          p.textSize(8);
          p.textAlign(p.CENTER, p.CENTER);
          p.text("O₂", o.x, o.y);
          
          // Age the particle
          o.age += speed;
          
          // Remove if too old
          if (o.age > 500) {
            oxygen.splice(i, 1);
          }
        }
      }
      
      function updateATP() {
        for (let i = atp.length - 1; i >= 0; i--) {
          const a = atp[i];
          
          // Move
          a.x += a.vx * speed;
          a.y += a.vy * speed;
          
          // Bounce off walls
          if (a.x < 0 || a.x > WIDTH) a.vx *= -1;
          if (a.y < 0 || a.y > HEIGHT) a.vy *= -1;
          
          // Draw
          p.fill(ATP_COLOR);
          p.ellipse(a.x, a.y, a.size);
          
          // Add ATP label
          p.fill(0);
          p.textSize(8);
          p.textAlign(p.CENTER, p.CENTER);
          p.text("ATP", a.x, a.y);
          
          // Age the particle
          a.age += speed;
          
          // Remove if too old or out of bounds
          if (a.age > 300 || a.y < 0 || a.y > HEIGHT || a.x < 0 || a.x > WIDTH) {
            atp.splice(i, 1);
          }
        }
      }
      
      function updateCO2() {
        for (let i = co2.length - 1; i >= 0; i--) {
          const c = co2[i];
          
          // Move
          c.x += c.vx * speed;
          c.y += c.vy * speed;
          
          // Draw
          p.fill(CO2_COLOR);
          p.ellipse(c.x, c.y, c.size);
          
          // Add CO2 label
          p.fill(255);
          p.textSize(7);
          p.textAlign(p.CENTER, p.CENTER);
          p.text("CO₂", c.x, c.y);
          
          // Age the particle
          c.age += speed;
          
          // Remove if too old or out of bounds
          if (c.age > 200 || c.y < 0 || c.y > HEIGHT || c.x < 0 || c.x > WIDTH) {
            co2.splice(i, 1);
          }
        }
      }
      
      function updateWater() {
        for (let i = water.length - 1; i >= 0; i--) {
          const w = water[i];
          
          // Move
          w.x += w.vx * speed;
          w.y += w.vy * speed;
          
          // Draw
          p.fill(WATER_COLOR);
          p.ellipse(w.x, w.y, w.size);
          
          // Add H2O label
          p.fill(255);
          p.textSize(7);
          p.textAlign(p.CENTER, p.CENTER);
          p.text("H₂O", w.x, w.y);
          
          // Age the particle
          w.age += speed;
          
          // Remove if too old or out of bounds
          if (w.age > 200 || w.y < 0 || w.y > HEIGHT || w.x < 0 || w.x > WIDTH) {
            water.splice(i, 1);
          }
        }
      }
      
      function updateElectrons() {
        for (let i = electrons.length - 1; i >= 0; i--) {
          const e = electrons[i];
          
          // Move
          e.x += e.vx * speed;
          e.y += e.vy * speed;
          
          // Find the nearest cristae
          let closestCrista = null;
          let minDist = Infinity;
          
          for (const crista of cristae) {
            const dist = p.dist(e.x, e.y, crista.x, (crista.yTop + crista.yBottom) / 2);
            if (dist < minDist) {
              minDist = dist;
              closestCrista = crista;
            }
          }
          
          // If close to a crista, move along it
          if (closestCrista && minDist < 30) {
            // Move toward the crista
            const cristaX = closestCrista.x;
            const cristaY = p.random(closestCrista.yTop, closestCrista.yBottom);
            
            e.vx = (cristaX - e.x) * 0.05 * speed;
            e.vy = (cristaY - e.y) * 0.05 * speed;
          }
          
          // Draw
          p.fill(ELECTRON_COLOR);
          p.ellipse(e.x, e.y, e.size);
          
          // Add e- label
          p.fill(255);
          p.textSize(6);
          p.textAlign(p.CENTER, p.CENTER);
          p.text("e⁻", e.x, e.y);
          
          // Age the particle
          e.age += speed;
          
          // Create ATP after electron has traveled along the electron transport chain
          if (e.age > 60 && p.random() < 0.03 * speed) {
            createATP(e.x, e.y);
            electrons.splice(i, 1);
          }
          
          // Remove if too old
          if (e.age > 150) {
            electrons.splice(i, 1);
          }
        }
      }
      
      function checkForReactions() {
        // Check for glucose + oxygen reactions (glycolysis + Krebs cycle)
        for (let g = glucose.length - 1; g >= 0; g--) {
          // Check if glucose is inside the mitochondria
          const glucoseObj = glucose[g];
          if (isInsideMitochondria(glucoseObj.x, glucoseObj.y)) {
            let oxygenCount = 0;
            let nearbyOxygen = [];
            
            // Find nearby oxygen molecules
            for (let o = oxygen.length - 1; o >= 0; o--) {
              const oxygenObj = oxygen[o];
              if (isInsideMitochondria(oxygenObj.x, oxygenObj.y)) {
                const distance = p.dist(glucoseObj.x, glucoseObj.y, oxygenObj.x, oxygenObj.y);
                if (distance < 50) {
                  nearbyOxygen.push(o);
                  oxygenCount++;
                  
                  // If we have enough oxygen for the reaction, break
                  if (oxygenCount >= 6) {
                    break;
                  }
                }
              }
            }
            
            // Complete reaction if we have glucose + 6 oxygen
            if (oxygenCount >= 6 && p.random() < 0.1 * speed) {
              // Remove the reactants
              nearbyOxygen.sort((a, b) => b - a);  // Sort in descending order
              for (const idx of nearbyOxygen) {
                if (idx < oxygen.length) {
                  oxygen.splice(idx, 1);
                }
              }
              glucose.splice(g, 1);
              
              // Create products: 6 CO2 + 6 H2O
              for (let i = 0; i < 6; i++) {
                createCO2(glucoseObj.x + p.random(-30, 30), glucoseObj.y + p.random(-30, 30));
                createWater(glucoseObj.x + p.random(-30, 30), glucoseObj.y + p.random(-30, 30));
              }
              
              // Create electrons for electron transport chain
              for (let i = 0; i < 10; i++) {
                createElectron(glucoseObj.x + p.random(-20, 20), glucoseObj.y + p.random(-20, 20));
              }
            }
          }
        }
      }
      
      function isInsideMitochondria(x, y) {
        const innerPadding = 15;
        return x > mitochondriaOuterX + innerPadding && 
               x < mitochondriaOuterX + mitochondriaOuterWidth - innerPadding && 
               y > mitochondriaOuterY + innerPadding && 
               y < mitochondriaOuterY + mitochondriaOuterHeight - innerPadding;
      }
      
      function createATP(x, y) {
        atp.push({
          x: x,
          y: y,
          vx: p.random(-1, 1) * speed,
          vy: p.random(-1, 1) * speed,
          size: 12,
          age: 0
        });
      }
      
      function createCO2(x, y) {
        co2.push({
          x: x,
          y: y,
          vx: p.random(-1, 1) * speed,
          vy: p.random(-2, -0.5) * speed,  // Moving upward
          size: 8,
          age: 0
        });
      }
      
      function createWater(x, y) {
        water.push({
          x: x,
          y: y,
          vx: p.random(-1, 1) * speed,
          vy: p.random(-1, 1) * speed,
          size: 8,
          age: 0
        });
      }
      
      function createElectron(x, y) {
        electrons.push({
          x: x,
          y: y,
          vx: p.random(-1, 1) * speed,
          vy: p.random(-1, 1) * speed,
          size: 6,
          age: 0
        });
      }
      
      function drawLegend() {
        const legendX = 10;
        const legendY = 10;
        const itemHeight = 15;
        
        p.fill(0);
        p.textSize(10);
        p.textAlign(p.LEFT, p.CENTER);
        
        // Glucose
        p.fill(GLUCOSE_COLOR);
        p.ellipse(legendX + 5, legendY + itemHeight * 0, 10);
        p.fill(0);
        p.text("Glucose (C₆H₁₂O₆)", legendX + 15, legendY + itemHeight * 0);
        
        // Oxygen
        p.fill(OXYGEN_COLOR);
        p.ellipse(legendX + 5, legendY + itemHeight * 1, 8);
        p.fill(0);
        p.text("Oxygen (O₂)", legendX + 15, legendY + itemHeight * 1);
        
        // ATP
        p.fill(ATP_COLOR);
        p.ellipse(legendX + 5, legendY + itemHeight * 2, 10);
        p.fill(0);
        p.text("ATP", legendX + 15, legendY + itemHeight * 2);
        
        // CO2
        p.fill(CO2_COLOR);
        p.ellipse(legendX + 5, legendY + itemHeight * 3, 8);
        p.fill(0);
        p.text("Carbon Dioxide (CO₂)", legendX + 15, legendY + itemHeight * 3);
        
        // Water
        p.fill(WATER_COLOR);
        p.ellipse(legendX + 5, legendY + itemHeight * 4, 8);
        p.fill(0);
        p.text("Water (H₂O)", legendX + 15, legendY + itemHeight * 4);
        
        // Electron
        p.fill(ELECTRON_COLOR);
        p.ellipse(legendX + 5, legendY + itemHeight * 5, 6);
        p.fill(0);
        p.text("Electron (e⁻)", legendX + 15, legendY + itemHeight * 5);
        
        // Equation
        p.text("C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ~36 ATP", WIDTH - 250, HEIGHT - 20);
      }
    };

    let myP5 = new p5(sketch, canvasRef.current);

    return () => {
      myP5.remove();
    };
  }, [isPlaying, speed]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSpeedChange = (e) => {
    setSpeed(parseFloat(e.target.value));
  };

  return (
    <div className="flex flex-col items-center w-full p-4 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Mitochondria Cellular Respiration</h2>
      <p className="mb-4 text-gray-700">
        This simulation shows how glucose (C₆H₁₂O₆) and oxygen (O₂) are converted to 
        ATP, carbon dioxide (CO₂), and water (H₂O) in the mitochondria.
      </p>
      
      <div ref={canvasRef} className="border border-gray-300 rounded-lg shadow-md" />
      
      <div className="flex items-center mt-4 space-x-4">
        <button 
          onClick={handlePlayPause}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        
        <div className="flex items-center">
          <span className="mr-2">Speed:</span>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.5"
            value={speed}
            onChange={handleSpeedChange}
            className="w-32"
          />
          <span className="ml-2">{speed}x</span>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-white rounded-lg shadow-md w-full max-w-2xl">
        <h3 className="text-lg font-semibold mb-2">How This Works:</h3>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            <strong>Glycolysis:</strong> Glucose enters the mitochondria and undergoes initial breakdown.
          </li>
          <li>
            <strong>Krebs Cycle:</strong> Further breakdown occurs, generating electrons and CO₂.
          </li>
          <li>
            <strong>Electron Transport Chain:</strong> Electrons move along the cristae (inner membrane folds), 
            creating a proton gradient.
          </li>
          <li>
            <strong>ATP Synthesis:</strong> The energy from the proton gradient is used to produce ATP molecules.
          </li>
          <li>
            <strong>Waste Products:</strong> CO₂ and H₂O are released as byproducts of the process.
          </li>
        </ol>
        <p className="mt-4 text-sm text-gray-600">
          Note: This is a simplified simulation. The actual process involves many more 
          complex steps and molecules.
        </p>
      </div>
    </div>
  );
};

export default MitochondriaSimulation;