'use client';

// app/catapult/page.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from "@/components/ui/button";

// Use dynamic import with SSR disabled for the catapult simulator
// This avoids errors related to window/document not being available during server-side rendering
const CatapultSimulator = dynamic(() => import('@/components/science/catapult/CatapultSimulator'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-white rounded-lg shadow-md">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Catapult Simulator...</p>
      </div>
    </div>
  ),
});

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => import('@/components/GeminiEnhancedTutor'), {
  ssr: false
});

export default function CatapultPage() {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // Catapult simulation info with educational metadata
  const simulationInfo = {
    title: 'Catapult Physics Simulator',
    description: 'An interactive simulation demonstrating projectile motion, potential and kinetic energy conversion, and the physics of trajectory in a catapult system.',
    subject: 'Physics',
    skill: 'Projectile Motion',
    subskill: 'Energy Conversion'
  };

  return (
    <div className="min-h-screen bg-blue-50 py-8">
      <Head>
        <title>Catapult Physics Simulator</title>
        <meta name="description" content="Interactive Physics Catapult Simulator" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content area with your existing Catapult simulator */}
          <main className="lg:w-2/3 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Catapult Physics Simulator</h1>
              <Button 
                variant="outline" 
                onClick={() => setShowTutor(!showTutor)}
              >
                {showTutor ? 'Hide AI Tutor' : 'Show AI Tutor'}
              </Button>
            </div>
            
            <div className="w-full bg-white rounded-lg shadow-md">
              <CatapultSimulator />
            </div>
            
            <div className="mt-8 bg-gray-100 p-4 rounded-lg w-full">
              <h2 className="text-xl font-bold mb-2">About Catapult Physics</h2>
              <p className="mb-2">
                Catapults demonstrate several fundamental physics concepts including projectile motion, 
                potential and kinetic energy conversion, and the effects of launch angle on trajectory.
              </p>
              <p>
                This simulator allows students to adjust variables like launch angle, initial force, 
                and projectile mass to observe how these factors affect the flight path and distance.
              </p>
            </div>
            
            <footer className="mt-8 text-center text-gray-500">
              <p>Created with Next.js, React, and Physics Simulation</p>
            </footer>
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
    </div>
  );
}