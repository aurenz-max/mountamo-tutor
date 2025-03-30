'use client';
// components/GasSimulation.js
import { useState, useEffect, useRef } from 'react';
import Matter from 'matter-js';

const GasSimulation = () => {
  const [volume, setVolume] = useState(10);
  const [temp, setTemp] = useState(300);
  const [moles, setMoles] = useState(1);
  const [pressure, setPressure] = useState(1);
  const sceneRef = useRef(null);
  const engineRef = useRef(Matter.Engine.create());
  const R = 0.0821;

  useEffect(() => {
    const { Engine, Render, Runner, Composite, Bodies } = Matter;
    const engine = engineRef.current;
    
    // Setup renderer
    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: 600,
        height: 400,
        wireframes: false,
        background: '#f0f0f0'
      }
    });

    // Create container walls
    const container = Bodies.rectangle(300, 200, volume * 60, 360, {
      isStatic: true,
      render: {
        fillStyle: '#f8f8f8',
        strokeStyle: '#333',
        lineWidth: 2
      }
    });

    // Add mouse control
    const mouse = Matter.Mouse.create(render.canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {visible: false}
      }
    });

    Composite.add(engine.world, [container, mouseConstraint]);
    Render.run(render);
    const runner = Runner.run(engine);

    return () => {
      Render.stop(render);
      Runner.stop(runner);
      Composite.clear(engine.world);
    };
  }, []);

  // Update simulation when parameters change
  useEffect(() => {
    const { Bodies, Composite, World } = Matter;
    const engine = engineRef.current;
    
    // Update particles based on moles
    const currentParticles = engine.world.bodies.filter(b => b.label === 'particle');
    const targetCount = Math.floor(moles * 20);
    
    if (targetCount > currentParticles.length) {
      const newParticles = Array(targetCount - currentParticles.length).fill()
        .map(() => Bodies.circle(
          Math.random() * volume * 60 + 20,
          Math.random() * 360 + 20,
          8, {
            restitution: 0.9,
            render: {
              fillStyle: '#0066cc'
            },
            label: 'particle'
          }));
      Composite.add(engine.world, newParticles);
    } else if (targetCount < currentParticles.length) {
      const toRemove = currentParticles.slice(targetCount);
      Composite.remove(engine.world, toRemove);
    }

    // Update temperature (particle velocity)
    engine.world.bodies.forEach(body => {
      if (body.label === 'particle') {
        Matter.Body.setVelocity(body, {
          x: body.velocity.x * (temp / 300),
          y: body.velocity.y * (temp / 300)
        });
      }
    });

    // Update container size based on volume
    const container = engine.world.bodies.find(b => b.label !== 'particle' && !b.isStatic);
    if (container) {
      Matter.Body.setVertices(container, Matter.Vertices.fromPath(
        `0 0 ${volume * 60} 0 ${volume * 60} 360 0 360`
      ));
    }

    // Calculate pressure
    setPressure((moles * R * temp) / volume);
  }, [volume, temp, moles]);

  return (
    <div className="container">
      <h1>Advanced Gas PVT Simulation</h1>
      
      <div className="controls">
        <div className="input-group">
          <label>Volume (L): {volume.toFixed(1)}</label>
          <input
            type="range"
            min="5"
            max="30"
            step="0.5"
            value={volume}
            onChange={(e) => setVolume(e.target.valueAsNumber)}
          />
        </div>

        <div className="input-group">
          <label>Temperature (K): {temp.toFixed(0)}</label>
          <input
            type="range"
            min="100"
            max="600"
            value={temp}
            onChange={(e) => setTemp(e.target.valueAsNumber)}
          />
        </div>

        <div className="input-group">
          <label>Moles of Gas:</label>
          <input
            type="number"
            min="0.1"
            max="5"
            step="0.1"
            value={moles}
            onChange={(e) => setMoles(e.target.valueAsNumber)}
          />
        </div>
      </div>

      <div className="result">
        Calculated Pressure: <strong>{pressure.toFixed(2)} atm</strong>
      </div>

      <div ref={sceneRef} className="simulation-container" />
      
      <style jsx>{`
        .container {
          padding: 2rem;
          max-width: 800px;
          margin: 0 auto;
        }
        .controls {
          margin: 2rem 0;
          padding: 1rem;
          background: #f8f8f8;
          border-radius: 8px;
        }
        .input-group {
          margin: 1rem 0;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
        }
        input[type='range'] {
          width: 100%;
        }
        input[type='number'] {
          padding: 0.5rem;
          width: 100px;
        }
        .result {
          font-size: 1.2rem;
          margin: 1rem 0;
          padding: 1rem;
          background: #e8f4ff;
          border-radius: 4px;
        }
        .simulation-container {
          border: 2px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default GasSimulation;