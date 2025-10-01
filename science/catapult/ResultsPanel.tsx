"use client";

import React from 'react';
import styles from './CatapultSimulator.module.css';

const ResultsPanel = ({ gameState, resultText }) => {
  return (
    <div className={styles.results}>
      <h3>Launch Results</h3>
      <div className={styles.message}>{resultText}</div>
      <div className={styles.score}>Score: {gameState.score}</div>
      <div id="analytics">
        <div>Initial Velocity: <span>{gameState.initialVelocity.toFixed(2)}</span> m/s</div>
        <div>Distance Traveled: <span>{gameState.distanceTraveled.toFixed(1)}</span> m</div>
        <div>Maximum Height: <span>{gameState.maxHeight.toFixed(1)}</span> m</div>
        <div>Flight Time: <span>{gameState.flightTime.toFixed(1)}</span> s</div>
      </div>
    </div>
  );
};

export default ResultsPanel;