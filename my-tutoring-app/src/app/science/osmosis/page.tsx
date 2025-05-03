'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { Button } from "@/components/ui/button";

// Dynamically import the OsmosisSimulation component
// 'ssr: false' ensures this component is only rendered on the client-side
const OsmosisSimulationComponent = dynamic(
  () => import('@/components/science/osmosis/OsmosisSimulationV2'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] flex items-center justify-center bg-white rounded-lg shadow-md">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Osmosis Simulation...</p>
        </div>
      </div>
    ),
  }
);

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => import('@/components/GeminiEnhancedTutor'), {
  ssr: false
});

export default function OsmosisPage() {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // Osmosis simulation info with educational metadata
  const simulationInfo = {
    title: 'Osmosis Molecular Simulation',
    description: 'An interactive simulation demonstrating osmosis at the molecular level, showing how water molecules move across semipermeable membranes from areas of low solute concentration to areas of high solute concentration.',
    subject: 'Biology',
    skill: 'Cell Transport',
    subskill: 'Osmosis'
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Head>
        <title>Osmosis Simulation</title>
        <meta name="description" content="Interactive Osmosis Simulation in React/Next.js" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content area with your existing Osmosis simulation */}
          <main className="lg:w-2/3 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Biology Experiment: Osmosis (Molecular View)</h1>
              <Button 
                variant="outline" 
                onClick={() => setShowTutor(!showTutor)}
              >
                {showTutor ? 'Hide AI Tutor' : 'Show AI Tutor'}
              </Button>
            </div>
            
            <div className="w-full bg-white rounded-lg shadow-md p-4">
              <OsmosisSimulationComponent />
            </div>
            
            <div className="mt-8 bg-gray-100 p-4 rounded-lg w-full">
              <h2 className="text-xl font-bold mb-2">About Osmosis</h2>
              <p className="mb-2">
                Osmosis is the movement of water molecules across a semipermeable membrane from an area 
                of lower solute concentration to an area of higher solute concentration. This process is 
                passive, meaning it requires no energy input.
              </p>
              <p>
                In living cells, osmosis is crucial for maintaining water balance. When cells are placed 
                in different solutions, water moves in or out depending on the relative concentration of 
                solutes inside and outside the cell, potentially causing cells to swell, maintain stability, 
                or shrink.
              </p>
            </div>
            
            <footer className="mt-8 text-center text-gray-500">
              Experiment by AI
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