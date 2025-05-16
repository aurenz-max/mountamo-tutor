// src/components/SimulationCanvas.js
"use client"; // <--- Add this directive!

import React, { useRef, useEffect, useMemo } from 'react';
import { Stage, Layer, Rect, Circle } from 'react-konva';
import Konva from 'konva';

const BASE_TEMPERATURE = 300;
const SPEED_FACTOR = 0.1;

function SimulationCanvas({ particles, setParticles, containerWidth, containerHeight, temperature }) {
    const layerRef = useRef(null);
    const animationRef = useRef(null);

    const speedScale = useMemo(() => {
        return Math.sqrt(temperature / BASE_TEMPERATURE);
    }, [temperature]);

    useEffect(() => {
        if (!layerRef.current) return;
        if (animationRef.current) {
            animationRef.current.stop();
        }

        const anim = new Konva.Animation(frame => {
            if (!frame || !particles) return;
            const timeDiff = frame.timeDiff / 1000;
            const nextParticles = particles.map(p => {
                let newX = p.x + p.vx * timeDiff * speedScale * SPEED_FACTOR;
                let newY = p.y + p.vy * timeDiff * speedScale * SPEED_FACTOR;
                let newVx = p.vx;
                let newVy = p.vy;

                if (newX < p.radius || newX > containerWidth - p.radius) {
                    newVx = -newVx;
                    newX = Math.max(p.radius, Math.min(newX, containerWidth - p.radius));
                }
                if (newY < p.radius || newY > containerHeight - p.radius) {
                    newVy = -newVy;
                    newY = Math.max(p.radius, Math.min(newY, containerHeight - p.radius));
                }
                return { ...p, x: newX, y: newY, vx: newVx, vy: newVy };
            });
            setParticles(nextParticles);
        }, layerRef.current);

        animationRef.current = anim;
        anim.start();

        return () => {
             if (animationRef.current) {
                 animationRef.current.stop();
             }
        };
    }, [particles, setParticles, containerWidth, containerHeight, speedScale]);

    return (
        <Stage width={containerWidth} height={containerHeight}>
            <Layer ref={layerRef}>
                <Rect
                    x={0} y={0} width={containerWidth} height={containerHeight}
                    stroke="black" strokeWidth={2} fill="#f0f0f0"
                />
                {particles.map(particle => (
                    <Circle
                        key={particle.id} x={particle.x} y={particle.y}
                        radius={particle.radius} fill="royalblue"
                    />
                ))}
            </Layer>
        </Stage>
    );
}

export default SimulationCanvas;