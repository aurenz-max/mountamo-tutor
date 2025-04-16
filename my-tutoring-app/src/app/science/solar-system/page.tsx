// pages/solar-system.js
import React from 'react';
import Head from 'next/head';
import SolarSystem from '@/components/science/solar-system/solar-system';
import styles from '@/components/science/solar-system/SolarSystem.module.css';

export default function SolarSystemPage() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Solar System Simulation</title>
        <meta name="description" content="Interactive 3D Solar System simulation built with Three.js and Next.js" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Solar System Simulation
        </h1>
        
        <div className={styles.simulationContainer}>
          <SolarSystem />
        </div>
        
        <div className={styles.infoPanel}>
          <h2>Solar System Facts</h2>
          <ul>
            <li><strong>Sun:</strong> The star at the center of our solar system</li>
            <li><strong>Mercury:</strong> Smallest planet, closest to the Sun</li>
            <li><strong>Venus:</strong> Hottest planet due to greenhouse effect</li>
            <li><strong>Earth:</strong> Our home planet, the only known planet with life</li>
            <li><strong>Mars:</strong> Known as the Red Planet</li>
            <li><strong>Jupiter:</strong> Largest planet in our solar system</li>
            <li><strong>Saturn:</strong> Famous for its extensive ring system</li>
            <li><strong>Uranus:</strong> Rotates on its side</li>
            <li><strong>Neptune:</strong> Windiest planet with the strongest storms</li>
          </ul>
          
          <div className={styles.controls}>
            <h3>Controls</h3>
            <p>Click and drag to rotate the view</p>
            <p>Scroll to zoom in/out</p>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>Created with Next.js and Three.js</p>
      </footer>
    </div>
  );
}