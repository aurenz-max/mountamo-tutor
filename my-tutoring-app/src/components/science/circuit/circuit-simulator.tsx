import React, { useEffect, useRef, useState } from 'react';
import _ from 'lodash';

const CircuitSimulator = () => {
  const sketchRef = useRef(null);
  const [p5, setP5] = useState(null);
  const [voltage, setVoltage] = useState(9);
  const [resistance, setResistance] = useState(100);
  const [isCircuitClosed, setIsCircuitClosed] = useState(true);
  const [activeTab, setActiveTab] = useState('circuit');
  const [current, setCurrent] = useState(0.09);
  const [power, setPower] = useState(0.81);

  // Load p5.js dynamically
  useEffect(() => {
    import('https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.6.0/p5.min.js')
      .then(p5Module => {
        // p5 is available in the window object after import
        const p5Instance = new window.p5(sketch, sketchRef.current);
        setP5(p5Instance);
        
        // Clean up
        return () => {
          p5Instance.remove();
        };
      });
  }, []);

  // Update calculations when inputs change
  useEffect(() => {
    if (isCircuitClosed) {
      const calculatedCurrent = voltage / resistance;
      const calculatedPower = voltage * calculatedCurrent;
      setCurrent(calculatedCurrent);
      setPower(calculatedPower);
    } else {
      setCurrent(0);
      setPower(0);
    }
  }, [voltage, resistance, isCircuitClosed]);

  // The p5.js sketch
  const sketch = (p) => {
    let width, height;
    let batteryImg, resistorImg, bulbOnImg, bulbOffImg, switchClosedImg, switchOpenImg;
    let currentParticles = [];
    
    p.preload = () => {
      // Create placeholders for images (since real images aren't available)
      batteryImg = null;
      resistorImg = null;
      bulbOnImg = null;
      bulbOffImg = null;
      switchClosedImg = null;
      switchOpenImg = null;
    };
    
    p.setup = () => {
      width = 600;
      height = 400;
      p.createCanvas(width, height);
      
      // Initialize current flow particles
      resetParticles();
    };
    
    p.draw = () => {
      p.background(255);
      
      const centerX = width / 2;
      const centerY = height / 2;
      const circuitWidth = width * 0.7;
      const circuitHeight = height * 0.7;
      
      // Draw the circuit
      drawCircuit(p, centerX, centerY, circuitWidth, circuitHeight);
      
      // Draw status text
      drawStatusText(p, width, height);
      
      // Animate current flow if circuit is closed
      if (isCircuitClosed) {
        animateCurrentFlow(p);
      }
    };
    
    const drawCircuit = (p, centerX, centerY, circuitWidth, circuitHeight) => {
      // Define component positions
      const batteryX = centerX - circuitWidth / 2;
      const batteryY = centerY;
      const batteryHeight = 60;
      
      const resistorX = centerX;
      const resistorY = centerY - circuitHeight / 2;
      const resistorWidth = 60;
      
      const bulbX = centerX + circuitWidth / 2;
      const bulbY = centerY;
      const bulbRadius = 25;
      
      const switchX = centerX;
      const switchY = centerY + circuitHeight / 2;
      const switchWidth = 40;
      
      // Draw wires
      p.stroke(40);
      p.strokeWeight(4);
      p.noFill();
      
      // Left vertical wire
      p.line(batteryX, batteryY + batteryHeight / 2, batteryX, centerY + circuitHeight / 2);
      
      // Bottom wire with switch
      if (isCircuitClosed) {
        p.line(batteryX, centerY + circuitHeight / 2, centerX - switchWidth / 2, centerY + circuitHeight / 2);
        p.line(centerX + switchWidth / 2, centerY + circuitHeight / 2, bulbX, centerY + circuitHeight / 2);
      } else {
        p.line(batteryX, centerY + circuitHeight / 2, centerX - switchWidth / 2, centerY + circuitHeight / 2);
        p.line(centerX + switchWidth / 2, centerY + circuitHeight / 2 - 10, bulbX, centerY + circuitHeight / 2);
      }
      
      // Right vertical wire
      p.line(bulbX, centerY + circuitHeight / 2, bulbX, bulbY + bulbRadius);
      
      // Top right wire
      p.line(resistorX + resistorWidth / 2, resistorY, bulbX, resistorY);
      p.line(bulbX, resistorY, bulbX, bulbY - bulbRadius);
      
      // Top left wire
      p.line(batteryX, resistorY, resistorX - resistorWidth / 2, resistorY);
      
      // Left vertical (battery to top)
      p.line(batteryX, batteryY - batteryHeight / 2, batteryX, resistorY);
      
      // Draw components
      drawBattery(p, batteryX, batteryY, batteryHeight);
      drawResistor(p, resistorX, resistorY, resistorWidth);
      drawBulb(p, bulbX, bulbY, bulbRadius);
      drawSwitch(p, switchX, switchY, switchWidth);
      
      // Draw labels
      drawLabels(p, width, height, batteryX, batteryY, resistorX, resistorY, bulbX, bulbY, switchX, switchY);
    };
    
    const drawBattery = (p, x, y, height) => {
      const width = 20;
      
      // Battery body
      p.fill(80);
      p.noStroke();
      p.rect(x - width / 2, y - height / 2, width, height, 2);
      
      // Battery terminals
      p.fill(40);
      p.rect(x - width / 2 - 5, y - height / 3, 5, height / 1.5, 1);  // Negative terminal
      p.rect(x + width / 2, y - height / 4, 5, height / 2, 1);  // Positive terminal
      
      // Positive and negative symbols
      p.fill(255);
      p.textSize(18);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('+', x, y - height / 5);
      p.text('-', x, y + height / 5);
      
      // Voltage label
      p.fill(0);
      p.textSize(14);
      p.text(`${voltage}V`, x, y + height / 2 + 20);
    };
    
    const drawResistor = (p, x, y, width) => {
      // Zigzag pattern
      p.push();
      p.translate(x, y);
      
      p.stroke('#A05A2C');  // Brown color for resistor
      p.strokeWeight(3);
      p.noFill();
      p.beginShape();
      
      // Draw zigzag
      const segments = 6;
      const segmentWidth = width / segments;
      const zigzagHeight = 10;
      
      p.vertex(-width / 2, 0);
      for (let i = 1; i < segments; i++) {
        const xPos = -width / 2 + i * segmentWidth;
        const yPos = i % 2 === 0 ? -zigzagHeight : zigzagHeight;
        p.vertex(xPos, yPos);
      }
      p.vertex(width / 2, 0);
      
      p.endShape();
      p.pop();
      
      // Resistance label
      p.fill(0);
      p.noStroke();
      p.textSize(14);
      p.textAlign(p.CENTER, p.CENTER);
      p.text(`${resistance}Ω`, x, y - 25);
    };
    
    const drawBulb = (p, x, y, radius) => {
      const brightness = isCircuitClosed ? Math.min(1, power / 2) : 0;
      
      // Bulb base
      p.fill(119);
      p.noStroke();
      p.beginShape();
      p.vertex(x - radius / 2, y + radius);
      p.vertex(x + radius / 2, y + radius);
      p.vertex(x + radius / 3, y + radius / 2);
      p.vertex(x - radius / 3, y + radius / 2);
      p.endShape(p.CLOSE);
      
      // Bulb glass
      p.strokeWeight(2);
      p.stroke(40);
      p.fill(brightness > 0 ? p.lerpColor(p.color(255), p.color(255, 255, 0), brightness) : 238);
      p.arc(x, y, radius * 2, radius * 2, p.PI, p.TWO_PI);
      
      // Filament
      p.stroke(brightness > 0 ? '#ffcc00' : '#999');
      p.strokeWeight(2);
      p.noFill();
      p.beginShape();
      p.vertex(x - radius / 3, y + radius / 2);
      p.quadraticVertex(x, y - radius / 3, x + radius / 3, y + radius / 2);
      p.endShape();
      
      // Glow effect when on
      if (brightness > 0) {
        p.noStroke();
        for (let i = 3; i > 0; i--) {
          let alpha = brightness * (1 - i/4) * 255;
          p.fill(255, 255, 100, alpha);
          p.ellipse(x, y, radius * (1 + i/2));
        }
      }
    };
    
    const drawSwitch = (p, x, y, width) => {
      // Switch bases
      p.fill(40);
      p.noStroke();
      p.ellipse(x - width / 2, y, 10);
      p.ellipse(x + width / 2, y, 10);
      
      // Switch lever
      p.stroke(85);
      p.strokeWeight(3);
      if (isCircuitClosed) {
        p.line(x - width / 2, y, x + width / 2, y);
      } else {
        p.line(x - width / 2, y, x + width / 2 - 5, y - 15);
      }
    };
    
    const drawLabels = (p, width, height, batteryX, batteryY, resistorX, resistorY, bulbX, bulbY, switchX, switchY) => {
      p.fill(0);
      p.noStroke();
      p.textSize(14);
      p.textAlign(p.CENTER, p.CENTER);
      
      // Component labels
      p.text('Battery', batteryX - 50, batteryY);
      p.text('Resistor', resistorX, resistorY - 45);
      p.text('Bulb', bulbX + 50, bulbY);
      p.text('Switch', switchX, switchY + 25);
    };
    
    const drawStatusText = (p, width, height) => {
      p.fill(0);
      p.noStroke();
      p.textSize(14);
      p.textAlign(p.CENTER, p.CENTER);
      
      if (isCircuitClosed) {
        p.text(`Current: ${current.toFixed(2)} A`, width / 2, height - 60);
        p.text(`Power: ${power.toFixed(2)} W`, width / 2, height - 35);
      } else {
        p.text('Circuit open - No current', width / 2, height - 45);
      }
    };
    
    const resetParticles = () => {
      currentParticles = [];
      const particleCount = 40;
      const circuitWidth = width * 0.7;
      const circuitHeight = height * 0.7;
      const centerX = width / 2;
      const centerY = height / 2;
      
      for (let i = 0; i < particleCount; i++) {
        // Calculate perimeter of circuit
        const perimeter = 2 * circuitWidth + 2 * circuitHeight;
        let position = p.random(perimeter);
        let x, y;
        
        // Position particles along the circuit path
        if (position < circuitWidth) {
          // Top side
          x = centerX - circuitWidth / 2 + position;
          y = centerY - circuitHeight / 2;
        } else if (position < circuitWidth + circuitHeight) {
          // Right side
          x = centerX + circuitWidth / 2;
          y = centerY - circuitHeight / 2 + (position - circuitWidth);
        } else if (position < 2 * circuitWidth + circuitHeight) {
          // Bottom side
          x = centerX + circuitWidth / 2 - (position - circuitWidth - circuitHeight);
          y = centerY + circuitHeight / 2;
        } else {
          // Left side
          x = centerX - circuitWidth / 2;
          y = centerY + circuitHeight / 2 - (position - 2 * circuitWidth - circuitHeight);
        }
        
        currentParticles.push({
          x,
          y,
          speed: p.map(p.random(), 0, 1, 0.5, 1.5)
        });
      }
    };
    
    const animateCurrentFlow = (p) => {
      const circuitWidth = width * 0.7;
      const circuitHeight = height * 0.7;
      const centerX = width / 2;
      const centerY = height / 2;
      const perimeter = 2 * circuitWidth + 2 * circuitHeight;
      const baseSpeed = 1 + (current / 5); // Speed based on current
      
      p.noStroke();
      p.fill(0, 120, 255, 180);
      
      currentParticles.forEach(particle => {
        // Calculate position on circuit
        const speedFactor = baseSpeed * particle.speed;
        let position = 0;
        
        // Top side
        if (particle.y === centerY - circuitHeight / 2 && 
            particle.x >= centerX - circuitWidth / 2 && 
            particle.x <= centerX + circuitWidth / 2) {
          position = particle.x - (centerX - circuitWidth / 2);
          particle.x -= speedFactor;
          if (particle.x < centerX - circuitWidth / 2) {
            particle.x = centerX - circuitWidth / 2;
            particle.y += speedFactor;
          }
        } 
        // Right side
        else if (particle.x === centerX + circuitWidth / 2 && 
                 particle.y >= centerY - circuitHeight / 2 && 
                 particle.y <= centerY + circuitHeight / 2) {
          position = circuitWidth + (particle.y - (centerY - circuitHeight / 2));
          particle.y += speedFactor;
          if (particle.y > centerY + circuitHeight / 2) {
            particle.y = centerY + circuitHeight / 2;
            particle.x -= speedFactor;
          }
        } 
        // Bottom side
        else if (particle.y === centerY + circuitHeight / 2 && 
                 particle.x >= centerX - circuitWidth / 2 && 
                 particle.x <= centerX + circuitWidth / 2) {
          position = circuitWidth + circuitHeight + ((centerX + circuitWidth / 2) - particle.x);
          particle.x -= speedFactor;
          if (particle.x < centerX - circuitWidth / 2) {
            particle.x = centerX - circuitWidth / 2;
            particle.y -= speedFactor;
          }
        } 
        // Left side
        else if (particle.x === centerX - circuitWidth / 2 && 
                 particle.y >= centerY - circuitHeight / 2 && 
                 particle.y <= centerY + circuitHeight / 2) {
          position = 2 * circuitWidth + circuitHeight + ((centerY + circuitHeight / 2) - particle.y);
          particle.y -= speedFactor;
          if (particle.y < centerY - circuitHeight / 2) {
            particle.y = centerY - circuitHeight / 2;
            particle.x += speedFactor;
          }
        }
        
        // Only show particles if circuit is closed
        if (isCircuitClosed) {
          if (!(particle.y > centerY + circuitHeight / 2 - 15 && 
                particle.y < centerY + circuitHeight / 2 + 15 && 
                particle.x > centerX - 20 && 
                particle.x < centerX + 20 && 
                !isCircuitClosed)) {
            p.ellipse(particle.x, particle.y, 6);
          }
        }
      });
    };
  };

  const handleToggleSwitch = () => {
    setIsCircuitClosed(!isCircuitClosed);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className="p-6 bg-white shadow">
        <h1 className="text-2xl font-bold text-center text-blue-600">Interactive Circuit Simulator with p5.js</h1>
      </div>
      
      <div className="flex flex-col md:flex-row flex-1">
        <div className="w-full md:w-2/3 p-6">
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex space-x-4 mb-4">
              <button 
                className={`px-4 py-2 rounded ${activeTab === 'circuit' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => setActiveTab('circuit')}
              >
                Circuit
              </button>
              <button 
                className={`px-4 py-2 rounded ${activeTab === 'concepts' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => setActiveTab('concepts')}
              >
                Concepts
              </button>
            </div>
            
            {activeTab === 'circuit' && (
              <div className="flex flex-col items-center">
                <div ref={sketchRef} className="border border-gray-300 bg-white rounded mb-4"></div>
                <button 
                  onClick={handleToggleSwitch}
                  className={`px-4 py-2 rounded ${isCircuitClosed ? 'bg-red-500' : 'bg-green-500'} text-white mb-4`}
                >
                  {isCircuitClosed ? 'Open Circuit' : 'Close Circuit'}
                </button>
              </div>
            )}
            
            {activeTab === 'concepts' && (
              <div className="space-y-4">
                <div className="border p-4 rounded bg-blue-50">
                  <h3 className="font-bold text-lg mb-2">Voltage (V)</h3>
                  <p>Voltage is the electric potential difference between two points, measured in volts (V). It's like the "pressure" that pushes electrons through a circuit.</p>
                </div>
                
                <div className="border p-4 rounded bg-blue-50">
                  <h3 className="font-bold text-lg mb-2">Current (I)</h3>
                  <p>Current is the flow of electric charge, measured in amperes (A). It represents how many electrons are flowing through a conductor per second.</p>
                </div>
                
                <div className="border p-4 rounded bg-blue-50">
                  <h3 className="font-bold text-lg mb-2">Resistance (R)</h3>
                  <p>Resistance is the opposition to current flow, measured in ohms (Ω). Resistors limit current flow in a circuit, converting some electrical energy to heat.</p>
                </div>
                
                <div className="border p-4 rounded bg-blue-50">
                  <h3 className="font-bold text-lg mb-2">Ohm's Law</h3>
                  <p>Ohm's Law states that the current through a conductor is proportional to the voltage and inversely proportional to the resistance: I = V/R</p>
                </div>
                
                <div className="border p-4 rounded bg-blue-50">
                  <h3 className="font-bold text-lg mb-2">Power (P)</h3>
                  <p>Power is the rate at which energy is transferred, measured in watts (W). In electrical circuits: P = VI or P = I²R or P = V²/R</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="w-full md:w-1/3 p-6">
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="text-xl font-bold mb-4">Circuit Controls</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Battery Voltage: {voltage} V
              </label>
              <input 
                type="range" 
                min="1" 
                max="24" 
                value={voltage} 
                onChange={(e) => setVoltage(Number(e.target.value))} 
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resistance: {resistance} Ω
              </label>
              <input 
                type="range" 
                min="1" 
                max="500" 
                value={resistance} 
                onChange={(e) => setResistance(Number(e.target.value))} 
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="mb-4 p-4 bg-gray-100 rounded">
              <h3 className="font-bold mb-2">Circuit Status:</h3>
              <p><strong>Circuit is:</strong> {isCircuitClosed ? 'Closed' : 'Open'}</p>
              <p><strong>Current:</strong> {isCircuitClosed ? `${current.toFixed(2)} A` : '0.00 A'}</p>
              <p><strong>Power:</strong> {isCircuitClosed ? `${power.toFixed(2)} W` : '0.00 W'}</p>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
              <h3 className="font-bold mb-2">Ohm's Law</h3>
              <p className="mb-2">I = V/R = {voltage}/{resistance} = {current.toFixed(4)} A</p>
              <p>Try adjusting the voltage and resistance values to see how current changes!</p>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-bold mb-2">Learning Points</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>The circuit uses a battery as a voltage source</li>
              <li>The resistor limits current flow to protect the bulb</li>
              <li>The switch controls whether current can flow</li>
              <li>Higher voltage = brighter bulb (more power)</li>
              <li>Higher resistance = dimmer bulb (less current)</li>
              <li>When the circuit is open, no current flows</li>
              <li>Current flows from positive to negative terminal</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircuitSimulator;