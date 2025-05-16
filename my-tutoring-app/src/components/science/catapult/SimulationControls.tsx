"use client";

import React from 'react';
import styles from './CatapultSimulator.module.css';

const SimulationControls = ({ gameState, onSliderChange, onLaunch, onReset, isLaunched }) => {
  // Handle slider input
  const handleSliderInput = (e) => {
    const { name, value, step } = e.target;
    // Convert to number, considering decimal steps if needed
    const numValue = step && step.includes('.') ? parseFloat(value) : parseInt(value);
    onSliderChange(name, numValue);
  };

  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <h3>Catapult Settings</h3>
        <div className={styles.controlItem}>
          <label htmlFor="force">Launch Force</label>
          <div className={styles.sliderContainer}>
            <input 
              type="range" 
              id="force" 
              name="force"
              min="10" 
              max="300" 
              value={gameState.force}
              onChange={handleSliderInput}
            />
            <span className={styles.valueDisplay}>{gameState.force}</span>
            <span>N</span>
          </div>
        </div>
        <div className={styles.controlItem}>
          <label htmlFor="angle">Launch Angle</label>
          <div className={styles.sliderContainer}>
            <input 
              type="range" 
              id="angle" 
              name="angle"
              min="10" 
              max="80" 
              value={gameState.angle}
              onChange={handleSliderInput}
            />
            <span className={styles.valueDisplay}>{gameState.angle}</span>
            <span>°</span>
          </div>
        </div>
      </div>
      
      <div className={styles.controlGroup}>
        <h3>Projectile Settings</h3>
        <div className={styles.controlItem}>
          <label htmlFor="mass">Projectile Mass</label>
          <div className={styles.sliderContainer}>
            <input 
              type="range" 
              id="mass" 
              name="mass"
              min="1" 
              max="10" 
              value={gameState.mass} 
              step="0.1"
              onChange={handleSliderInput}
            />
            <span className={styles.valueDisplay}>{gameState.mass.toFixed(1)}</span>
            <span>kg</span>
          </div>
        </div>
        <div className={styles.controlItem}>
          <label htmlFor="drag">Air Resistance</label>
          <div className={styles.sliderContainer}>
            <input 
              type="range" 
              id="drag" 
              name="drag"
              min="0" 
              max="0.05" 
              value={gameState.drag} 
              step="0.001"
              onChange={handleSliderInput}
            />
            <span className={styles.valueDisplay}>{gameState.drag.toFixed(3)}</span>
          </div>
        </div>
      </div>
      
      <div className={styles.controlGroup}>
        <h3>Simulation Controls</h3>
        <div className={styles.controlItem}>
          <div className={styles.buttonGroup}>
            <button 
              className={styles.button} 
              onClick={onLaunch}
              disabled={isLaunched}
            >
              Launch!
            </button>
            <button 
              className={styles.button} 
              onClick={onReset}
            >
              Reset
            </button>
          </div>
        </div>
        <div className={styles.controlItem}>
          <label htmlFor="gravity">Gravity</label>
          <div className={styles.sliderContainer}>
            <input 
              type="range" 
              id="gravity" 
              name="gravity"
              min="1" 
              max="20" 
              value={gameState.gravity} 
              step="0.1"
              onChange={handleSliderInput}
            />
            <span className={styles.valueDisplay}>{gameState.gravity.toFixed(1)}</span>
            <span>m/s²</span>
          </div>
        </div>
        <div className={`${styles.controlItem} ${styles.targetDifficulty}`}>
          <label htmlFor="difficulty">Target Difficulty</label>
          <div className={styles.sliderContainer}>
            <input 
              type="range" 
              id="difficulty" 
              name="difficulty"
              min="1" 
              max="3" 
              value={gameState.difficulty} 
              step="1"
              onChange={handleSliderInput}
            />
            <span className={styles.valueDisplay}>{gameState.difficulty}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationControls;