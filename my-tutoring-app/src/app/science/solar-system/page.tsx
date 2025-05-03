'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { Button } from "@/components/ui/button";
import styles from '@/components/science/solar-system/SolarSystem.module.css';

// Dynamically import the SolarSystem component
// 'ssr: false' ensures this component is only rendered on the client-side
const SolarSystemComponent = dynamic(
  () => import('@/components/science/solar-system/solar-system'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] flex items-center justify-center bg-white rounded-lg shadow-md">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Solar System Simulation...</p>
        </div>
      </div>
    ),
  }
);

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => import('@/components/GeminiEnhancedTutor'), {
  ssr: false
});

export default function SolarSystemPage() {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // Solar System simulation info with educational metadata
  const simulationInfo = {
    title: 'Solar System 3D Simulation',
    description: 'An interactive 3D simulation of our solar system showing the planets orbiting around the Sun, their relative sizes, distances, and orbital patterns.',
    subject: 'Astronomy',
    skill: 'Planetary Science',
    subskill: 'Solar System Structure'
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Solar System Simulation</title>
        <meta name="description" content="Interactive 3D Solar System simulation built with Three.js and Next.js" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content area with your existing Solar System simulation */}
          <main className="lg:w-2/3 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h1 className={styles.title}>Solar System Simulation</h1>
              <Button 
                variant="outline" 
                onClick={() => setShowTutor(!showTutor)}
              >
                {showTutor ? 'Hide AI Tutor' : 'Show AI Tutor'}
              </Button>
            </div>
            
            <div className={styles.simulationContainer}>
              <SolarSystemComponent />
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
          
          {/* AI Tutor panel */}
          {showTutor && (
            <div className="lg:w-1/3">
              <EnhancedGeminiTutor
                simulationTitle={simulationInfo.title}
                simulationDescription={simulationInfo.description}
                subject={simulationInfo.subject}
                skill={simulationInfo.skill}
                subskill={simulationInfo.subskill}
                className="sticky top-6 max-h-[calc(100vh-3rem)]"
              />
            </div>
          )}
        </div>
      </div>

      <footer className={styles.footer}>
        <p>Created with Next.js and Three.js</p>
      </footer>
    </div>
  );
}