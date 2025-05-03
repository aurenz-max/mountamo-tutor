'use client';

// pages/gas-simulation.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from "@/components/ui/button";

// Use dynamic import with SSR disabled for the gas simulation
// This avoids errors related to window/document not being available during server-side rendering
const GasSimulation = dynamic(() => import('@/components/science/gas/GasSimulation'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-white rounded-lg shadow-md">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Gas Simulation...</p>
      </div>
    </div>
  ),
});

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => import('@/components/GeminiEnhancedTutor'), {
  ssr: false
});

export default function GasSimulationPage() {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // Gas simulation info with educational metadata
  const simulationInfo = {
    title: 'Ideal Gas Law Simulation',
    description: 'An interactive simulation demonstrating the relationship between pressure, volume, temperature, and amount of gas as described by the ideal gas law: PV=nRT.',
    subject: 'Chemistry',
    skill: 'Gas Laws',
    subskill: 'Ideal Gas Law'
  };

  return (
    <div className="min-h-screen bg-blue-50 py-8">
      <Head>
        <title>Ideal Gas Law Simulation</title>
        <meta name="description" content="Interactive Ideal Gas Law Simulation" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content area with your existing Gas simulation */}
          <main className="lg:w-2/3 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Ideal Gas Law Simulation (PV=nRT)</h1>
              <Button 
                variant="outline" 
                onClick={() => setShowTutor(!showTutor)}
              >
                {showTutor ? 'Hide AI Tutor' : 'Show AI Tutor'}
              </Button>
            </div>
            
            <div className="w-full bg-white rounded-lg shadow-md">
              <GasSimulation />
            </div>
            
            <div className="mt-8 bg-gray-100 p-4 rounded-lg w-full">
              <h2 className="text-xl font-bold mb-2">About the Ideal Gas Law</h2>
              <p className="mb-2">
                The ideal gas law describes the relationship between pressure (P), volume (V), 
                amount of gas (n), and temperature (T) of a gas, represented by the equation PV=nRT, 
                where R is the gas constant.
              </p>
              <p>
                This simulation allows students to manipulate these variables and observe how 
                changing one parameter affects the others, helping visualize the fundamental 
                principles of gas behavior in a closed system.
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