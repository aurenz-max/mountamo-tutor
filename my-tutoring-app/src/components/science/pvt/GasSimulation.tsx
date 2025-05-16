'use client';

// my-tutoring-app\src\components\science\pvt\GasSimulation.tsx
import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import './GasSimulation.css';

// Import SimulationCanvas with no SSR to avoid server-side rendering issues
const SimulationCanvas = dynamic(() => import('./SimulationCanvas'), { 
  ssr: false,
  loading: ({ containerWidth, containerHeight }) => (
    <div style={{ 
      width: containerWidth, 
      height: containerHeight, 
      backgroundColor: '#f0f0f0', 
      border: '2px solid black',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <p>Loading simulation...</p>
    </div>
  )
});

// Constants
const BASE_CONTAINER_WIDTH = 300;
const CONTAINER_HEIGHT = 300;
const PARTICLE_RADIUS = 4;
const MAX_INITIAL_VELOCITY = 50; // Pixels per second (at BASE_TEMPERATURE)
const GAS_CONSTANT_R = 0.1; // Arbitrary gas constant for nice pressure values

// Helper function to generate random velocity components
const getRandomVelocity = () => ({
    vx: (Math.random() - 0.5) * 2 * MAX_INITIAL_VELOCITY, // Random vx between -MAX and +MAX
    vy: (Math.random() - 0.5) * 2 * MAX_INITIAL_VELOCITY, // Random vy between -MAX and +MAX
});

function GasSimulation() {
    const [temperature, setTemperature] = useState(300); // Kelvin
    const [volume, setVolume] = useState(5); // Arbitrary units (1-10)
    const [numParticles, setNumParticles] = useState(50); // Number of particles
    const [pressure, setPressure] = useState(0);
    const [particles, setParticles] = useState([]);
    const [isMounted, setIsMounted] = useState(false);

    // Calculate container width based on volume slider
    const containerWidth = BASE_CONTAINER_WIDTH + volume * 20; // Scale width with volume

    // Effect to check if component is mounted (client-side only)
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Function to initialize or update particle list
    const initializeParticles = useCallback((count, width, height) => {
        const newParticles = [];
        for (let i = 0; i < count; i++) {
            const velocity = getRandomVelocity();
            newParticles.push({
                id: i,
                x: PARTICLE_RADIUS + Math.random() * (width - 2 * PARTICLE_RADIUS),
                y: PARTICLE_RADIUS + Math.random() * (height - 2 * PARTICLE_RADIUS),
                vx: velocity.vx,
                vy: velocity.vy,
                radius: PARTICLE_RADIUS,
            });
        }
        setParticles(newParticles);
    }, []);

    // Effect to initialize particles when component mounts or numParticles changes
    useEffect(() => {
        if (isMounted) {
            initializeParticles(numParticles, containerWidth, CONTAINER_HEIGHT);
        }
    }, [numParticles, initializeParticles, containerWidth, isMounted]);

    // Effect to calculate pressure when n, T, or V changes
    useEffect(() => {
        if (volume > 0) {
            const calculatedPressure = (numParticles * GAS_CONSTANT_R * temperature) / volume;
            setPressure(calculatedPressure);
        } else {
            setPressure(Infinity); // Avoid division by zero
        }
    }, [numParticles, temperature, volume]);

    // Handler to update particle state
    const handleSetParticles = useCallback((newParticles) => {
        setParticles(newParticles);
    }, []);

    return (
        <div className="gas-simulation">
            <h2>Ideal Gas Law Simulation (PV=nRT)</h2>
            <div className="controls">
                <div className="control-group">
                    <label htmlFor="temperature">Temperature: {temperature.toFixed(0)} K</label>
                    <input
                        type="range"
                        id="temperature"
                        min="10"
                        max="600"
                        step="5"
                        value={temperature}
                        onChange={(e) => setTemperature(Number(e.target.value))}
                    />
                </div>
                <div className="control-group">
                    <label htmlFor="volume">Volume: {volume.toFixed(1)} (Arbitrary Units)</label>
                    <input
                        type="range"
                        id="volume"
                        min="1"
                        max="10"
                        step="0.5"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                    />
                </div>
                <div className="control-group">
                    <label htmlFor="numParticles">Number of Particles (n): {numParticles}</label>
                    <input
                        type="range"
                        id="numParticles"
                        min="5"
                        max="150"
                        step="1"
                        value={numParticles}
                        onChange={(e) => setNumParticles(Number(e.target.value))}
                    />
                </div>
            </div>

            <div className="display">
                <p>Calculated Pressure (P): {pressure.toFixed(2)} (Arbitrary Units)</p>
                <p>Container Width: {containerWidth.toFixed(0)}px, Height: {CONTAINER_HEIGHT}px</p>
            </div>

            <div className="simulation-container">
                {isMounted && (
                    <SimulationCanvas
                        particles={particles}
                        setParticles={handleSetParticles}
                        containerWidth={containerWidth}
                        containerHeight={CONTAINER_HEIGHT}
                        temperature={temperature}
                    />
                )}
            </div>
        </div>
    );
}

export default GasSimulation;