'use client';

import React from 'react';
import { Stage, Layer, Rect, Circle } from 'react-konva';

function KonvaStage({ width, height, particles, setLayerRef }) {
    return (
        <Stage width={width} height={height}>
            <Layer ref={setLayerRef}>
                {/* Container */}
                <Rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
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

export default KonvaStage;