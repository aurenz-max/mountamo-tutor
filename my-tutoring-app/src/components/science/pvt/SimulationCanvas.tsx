'use client';

// my-tutoring-app\src\components\science\pvt\SimulationCanvas.tsx
import React, { useRef, useEffect, useMemo } from 'react';
import { Stage, Layer, Rect, Circle } from 'react-konva';

// Base temperature for speed scaling comparison
const BASE_TEMPERATURE = 300; // Kelvin (arbitrary reference)
const SPEED_FACTOR = 0.1; // Adjusts overall animation speed

function SimulationCanvas({ particles, setParticles, containerWidth, containerHeight, temperature }) {
    const layerRef = useRef(null);
    const animationRef = useRef(null);

    // Memoize speed scale factor
    const speedScale = useMemo(() => {
        return Math.sqrt(temperature / BASE_TEMPERATURE);
    }, [temperature]);

    useEffect(() => {
        // Import Konva dynamically to avoid server-side rendering issues
        const importKonva = async () => {
            try {
                const { default: Konva } = await import('konva');
                
                // Ensure layer is available
                if (!layerRef.current) return;

                // Stop existing animation if it's running
                if (animationRef.current) {
                    animationRef.current.stop();
                }

                // Create and start the animation
                const anim = new Konva.Animation(frame => {
                    if (!frame || !particles) return;

                    const timeDiff = frame.timeDiff / 1000; // Time difference in seconds

                    const nextParticles = particles.map(p => {
                        // Calculate new position based on velocity, time difference, speed scale and factor
                        let newX = p.x + p.vx * timeDiff * speedScale * SPEED_FACTOR;
                        let newY = p.y + p.vy * timeDiff * speedScale * SPEED_FACTOR;
                        let newVx = p.vx;
                        let newVy = p.vy;

                        // Simple Wall Collision Detection & Bounce
                        // Left/Right walls
                        if (newX < p.radius || newX > containerWidth - p.radius) {
                            newVx = -newVx; // Reverse horizontal velocity
                            // Clamp position to prevent sticking slightly outside bounds
                            newX = Math.max(p.radius, Math.min(newX, containerWidth - p.radius));
                        }
                        // Top/Bottom walls
                        if (newY < p.radius || newY > containerHeight - p.radius) {
                            newVy = -newVy; // Reverse vertical velocity
                            // Clamp position
                            newY = Math.max(p.radius, Math.min(newY, containerHeight - p.radius));
                        }

                        return { ...p, x: newX, y: newY, vx: newVx, vy: newVy };
                    });

                    // Update the state in the parent component
                    setParticles(nextParticles);
                }, layerRef.current);

                animationRef.current = anim;
                anim.start();
            } catch (error) {
                console.error("Error loading Konva:", error);
            }
        };

        importKonva();

        // Cleanup function
        return () => {
            if (animationRef.current) {
                animationRef.current.stop();
            }
        };
    }, [particles, setParticles, containerWidth, containerHeight, speedScale]);

    return (
        <Stage width={containerWidth} height={containerHeight}>
            <Layer ref={layerRef}>
                {/* Container */}
                <Rect
                    x={0}
                    y={0}
                    width={containerWidth}
                    height={containerHeight}
                    stroke="black"
                    strokeWidth={2}
                    fill="#f0f0f0" // Light grey background
                />
                {/* Particles */}
                {particles.map(particle => (
                    <Circle
                        key={particle.id}
                        x={particle.x}
                        y={particle.y}
                        radius={particle.radius}
                        fill="royalblue"
                    />
                ))}
            </Layer>
        </Stage>
    );
}

export default SimulationCanvas;