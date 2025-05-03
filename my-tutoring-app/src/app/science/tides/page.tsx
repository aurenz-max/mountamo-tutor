'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { Button } from "@/components/ui/button";

// Dynamically import the TideSimulation component
// 'ssr: false' ensures this component is only rendered on the client-side
const TideSimulationComponent = dynamic(
  () => import('@/components/science/tides/TideSimulation'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] flex items-center justify-center bg-white rounded-lg shadow-md">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Tides Simulation...</p>
        </div>
      </div>
    ),
  }
);

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => import('@/components/GeminiEnhancedTutor'), {
  ssr: false
});

export default function TidesPage() {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // Tides simulation info with educational metadata
  const simulationInfo = {
    title: 'Earth-Moon Tidal Interaction Simulation',
    description: 'An interactive simulation demonstrating how the gravitational interaction between the Earth and Moon creates tidal forces that result in ocean tides on Earth.',
    subject: 'Earth Science',
    skill: 'Oceanography',
    subskill: 'Tidal Phenomena'
  };

  return (
    <div className="flex flex-col items-center min-h-screen">
      <Head>
        <title>Tides Simulation (Next.js + p5.js)</title>
        <meta name="description" content="Demonstration of Moon's effect on tides" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4 py-8 w-full flex-1">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content area with your existing Tides simulation */}
          <main className="lg:w-2/3 flex flex-col items-center text-center">
            <div className="flex items-center justify-between w-full mb-6">
              <h1 className="text-4xl md:text-5xl font-bold">
                Understanding Tides: Earth & Moon Interaction
              </h1>
              <Button 
                variant="outline" 
                onClick={() => setShowTutor(!showTutor)}
              >
                {showTutor ? 'Hide AI Tutor' : 'Show AI Tutor'}
              </Button>
            </div>
            
            <p className="text-lg md:text-xl mb-8">
              A visual demonstration using Next.js, React, and p5.js.
            </p>
            
            <div className="w-full max-w-7xl bg-white rounded-lg shadow-md p-4">
              <TideSimulationComponent />
            </div>

            <div className="mt-8 bg-gray-100 p-4 rounded-lg w-full text-left">
              <h2 className="text-xl font-bold mb-2">About Tides</h2>
              <p className="mb-2">
                Tides are the rise and fall of sea levels caused by the combined effects of the 
                gravitational forces exerted by the Moon and the Sun, and the rotation of the Earth. 
                The gravitational attraction of the Moon causes the oceans to bulge out in the direction 
                of the Moon.
              </p>
              <p>
                Another bulge occurs on the opposite side of the Earth, where the Moon's pull is weakest. 
                As the Earth rotates, different parts of the Earth pass through these bulges, experiencing 
                high tides. The areas outside the bulges experience low tides. Most coastal areas experience 
                two high tides and two low tides every lunar day (approximately 24 hours and 50 minutes).
              </p>
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

      <footer className="flex items-center justify-center w-full h-20 border-t mt-auto">
        Powered by Imagination and Gravity
      </footer>
    </div>
  );
}