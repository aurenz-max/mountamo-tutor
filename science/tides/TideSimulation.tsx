'use client';

import React, { useState } from 'react';
import { ReactP5Wrapper } from '@p5-wrapper/react';
import p5 from 'p5';

function sketch(p) {
  let earthRadius = 100;
  let earthCoreRadius = 95;
  let moonDistance = 250;
  let moonRadius = 25;

  let moonAngle = 0;
  let earthRotationAngle = 0;

  // NEW: Fixed speeds based on real-world timing
  let earthRotationSpeed = 0.8; // 360° in 450 frames (7.5 seconds = 24 hours)
  let moonSpeed = 0.0293; // 360° in 12,285 frames (27.3 Earth rotations = 27.3 days)
  let gravitationalEffect = 1.0; // Controlled by slider

  let fixEarthView = false;

  let tidalHistory = [];
  let maxHistory = 200;

  p.updateWithProps = props => {
    if (props.gravitationalEffect !== undefined) {
      gravitationalEffect = props.gravitationalEffect;
    }
    if (props.fixEarthView !== undefined) {
      fixEarthView = props.fixEarthView;
    }
  };

  p.setup = () => {
    p.createCanvas(600, 700);
    p.angleMode(p.DEGREES);
    for (let i = 0; i < maxHistory; i++) {
      tidalHistory.push(0);
    }
  };

  p.draw = () => {
    p.background(0, 10, 25);
    p.translate(p.width / 2, p.height / 2 - 50);

    moonAngle = (moonAngle + moonSpeed) % 360;
    earthRotationAngle = (earthRotationAngle + earthRotationSpeed) % 360;

    let moonX = moonDistance * p.cos(moonAngle);
    let moonY = moonDistance * p.sin(moonAngle);

    p.push();
    if (fixEarthView) {
      p.rotate(moonAngle - earthRotationAngle);
    } else {
      p.rotate(moonAngle);
    }
    p.noStroke();
    p.fill(60, 120, 240, 150);
    let bulgeSize = earthRadius * 0.2 * gravitationalEffect;
    p.ellipse(0, 0, (earthRadius + bulgeSize) * 2, (earthRadius - bulgeSize / 2) * 2);
    p.pop();

    p.push();
    if (!fixEarthView) {
      p.rotate(earthRotationAngle);
    }
    p.noStroke();
    p.fill(50, 100, 50);
    p.ellipse(0, 0, earthCoreRadius * 2, earthCoreRadius * 2);
    p.stroke(255, 255, 255);
    p.strokeWeight(2);
    p.line(0, 0, earthCoreRadius, 0);

    p.stroke(255, 0, 0);
    p.strokeWeight(8);
    p.point(earthCoreRadius * 0.9, 0);
    p.pop();

    p.push();
    if (fixEarthView) {
      p.rotate(-earthRotationAngle);
      p.translate(moonDistance * p.cos(moonAngle), moonDistance * p.sin(moonAngle));
    } else {
      p.translate(moonX, moonY);
    }
    p.fill(200, 200, 200);
    p.noStroke();
    p.ellipse(0, 0, moonRadius * 2, moonRadius * 2);
    p.pop();

    if (fixEarthView) {
      p.push();
      p.rotate(-earthRotationAngle);
      p.stroke(255, 255, 0, 80);
      p.strokeWeight(1);
      p.line(0, 0, moonDistance * p.cos(moonAngle), moonDistance * p.sin(moonAngle));
      p.pop();
    } else {
      p.stroke(255, 255, 0, 80);
      p.strokeWeight(1);
      p.line(0, 0, moonX, moonY);
    }

    let angleDiff = (earthRotationAngle - moonAngle + 360) % 360;
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    let tidalHeight = p.cos(angleDiff * 2);
    tidalHeight = p.map(tidalHeight, -1, 1, -50, 50);

    tidalHistory.push(tidalHeight);
    tidalHistory.shift();

    p.push();
    p.translate(-p.width / 2, 300);
    p.fill(255);
    p.textAlign(p.CENTER);
    p.textSize(16);
    p.text("Tidal Height at Red Dot (Earth's Perspective)", p.width / 2, 20);

    p.stroke(255);
    p.strokeWeight(1);
    p.line(50, 50, 550, 50);
    p.line(50, 0, 50, 100);

    p.noFill();
    p.stroke(0, 255, 0);
    p.strokeWeight(2);
    p.beginShape();
    for (let i = 0; i < tidalHistory.length; i++) {
      let x = p.map(i, 0, tidalHistory.length - 1, 50, 550);
      let y = 50 - tidalHistory[i];
      p.vertex(x, y);
    }
    p.endShape();

    p.fill(255);
    p.noStroke();
    p.textSize(12);
    p.text("High Tide", 30, 0);
    p.text("Low Tide", 30, 100);
    p.pop();
  };
}

const TideSimulation = () => {
  const [moonEffect, setMoonEffect] = useState(1.0);
  const [fixEarthView, setFixEarthView] = useState(false);

  return (
    <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <div style={{ flex: '1 1 600px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '15px', textAlign: 'center' }}>Tidal Simulation</h2>
        <ReactP5Wrapper
          sketch={sketch}
          gravitationalEffect={moonEffect}
          fixEarthView={fixEarthView}
        />
        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              <input
                type="checkbox"
                checked={fixEarthView}
                onChange={(e) => setFixEarthView(e.target.checked)}
              />
              Fix Earth's View (Rotate Tides)
            </label>
          </div>
          <div>
            <label htmlFor="gravitySlider" style={{ display: 'block', marginBottom: '5px' }}>
              Moon's Gravitational Influence: {moonEffect.toFixed(2)}
            </label>
            <input
              id="gravitySlider"
              type="range"
              min="0.1"
              max="2.5"
              step="0.1"
              value={moonEffect}
              onChange={(e) => setMoonEffect(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          {/* NEW: Display timing information */}
          <div>
            <p style={{ margin: 0 }}>
              Timing: 7.5 seconds = 24 hours (Earth rotation), 27.3 days for Moon orbit.
            </p>
          </div>
        </div>
      </div>

      <div style={{ flex: '1 1 350px', minWidth: '300px', borderLeft: '1px solid #eee', paddingLeft: '20px' }}>
        <h3 style={{ marginTop: 0 }}>How Tides Work</h3>
        <p>
          This simulation emphasizes Earth's rotation as the primary driver of the daily tidal cycle.
        </p>
        <p>
          The Moon's gravity creates two <strong>tidal bulges</strong> (exaggerated here) in the Earth's oceans, aligned with the Moon. One bulge faces the Moon (stronger pull), and the other faces away (weaker pull/inertia).
        </p>
        <p>
          As a location on Earth (red dot) spins <strong>into</strong> a bulge, it experiences <strong>high tide</strong>. As it spins <strong>out of</strong> a bulge, it experiences <strong>low tide</strong>.
        </p>
        <p>
          There are two bulges, so most coastal locations experience two high tides and two low tides per rotation (approximately every 24 hours and 50 minutes, due to the Moon's orbit).
        </p>
        <h4>Key Controls:</h4>
        <ul>
          <li><strong>Fix Earth's View:</strong> Toggle between a space view (Earth rotates, tides are fixed relative to Moon) and an Earth view (Earth is fixed, tides rotate around it).</li>
          <li><strong>Moon's Gravitational Influence:</strong> Affects the size of the water bulges.</li>
        </ul>
        <h4>Timing:</h4>
        <ul>
          <li>Earth Rotation: 7.5 seconds in simulation = 24 hours in real time.</li>
          <li>Moon Orbit: 27.3 Earth rotations (204.75 seconds in simulation) = 27.3 days in real time.</li>
        </ul>
        <h4>Relevant Physics</h4>
        <p><strong>Newton's Law of Universal Gravitation:</strong></p>
        <code>F = G * (m1 * m2) / r²</code>
        <p>The force depends on mass and distance.</p>
        <p><strong>Tidal Force (Differential Gravity):</strong></p>
        <p>
          The difference in the Moon's gravitational pull across Earth's diameter creates the bulges, proportional to:
        </p>
        <code>F_tidal ∝ (M_moon / d³)</code>
        <p>This force determines the <i>location and size</i> of the bulges.</p>
        <p><strong>Earth's Rotation:</strong></p>
        <p>Determines the <i>frequency</i> at which a point on Earth passes through the bulges, causing the cycle of high and low tides.</p>
      </div>
    </div>
  );
};

export default TideSimulation;