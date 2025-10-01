"use client";

import React from 'react';
import styles from './CatapultSimulator.module.css';

const PhysicsInfo = () => {
  return (
    <div className={styles.physicsInfo}>
      <h3>Physics Behind the Simulation</h3>
      <p>This simulation models projectile motion with air resistance. The key equations used are:</p>
      <div className={styles.physicsFormula}>Initial Velocity = √(2 × Force / Mass)</div>
      <div className={styles.physicsFormula}>Horizontal Position: x = v₀ × cos(θ) × t - 0.5 × C × v² × cos(θ) × t²</div>
      <div className={styles.physicsFormula}>Vertical Position: y = v₀ × sin(θ) × t - 0.5 × g × t² - 0.5 × C × v² × sin(θ) × t²</div>
      <p>Where:</p>
      <ul>
        <li>v₀ = initial velocity</li>
        <li>θ = launch angle</li>
        <li>g = gravitational acceleration</li>
        <li>t = time</li>
        <li>C = drag coefficient</li>
        <li>v = velocity at time t</li>
      </ul>
      <p>Try different combinations of force, angle, mass, and air resistance to see how they affect the projectile&apos;s trajectory!</p>
    </div>
  );
};

export default PhysicsInfo;