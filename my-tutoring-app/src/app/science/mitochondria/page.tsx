'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { Button } from "@/components/ui/button";

// Dynamically import the MitochondriaSimulation component
// 'ssr: false' ensures this component is only rendered on the client-side
const MitochondriaSimulation = dynamic(
  () => import('@/components/science/mitochondria/mitochondria-simulation'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] flex items-center justify-center bg-white rounded-lg shadow-md">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Mitochondria Simulation...</p>
        </div>
      </div>
    ),
  }
);

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => import('@/components/GeminiEnhancedTutor'), {
  ssr: false
});

// Define the main page component
const MitochondriaPage = () => {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // Mitochondria simulation info with educational metadata
  const simulationInfo = {
    title: 'Mitochondria Cellular Respiration Simulation',
    description: 'An interactive simulation demonstrating the process of cellular respiration in mitochondria, including glycolysis, the Krebs cycle, and the electron transport chain.',
    subject: 'Biology',
    skill: 'Cellular Respiration',
    subskill: 'ATP Production'
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <Head>
        <title>Mitochondria Simulation | Next.js</title>
        <meta name="description" content="Client-side rendered p5.js simulation of mitochondria cellular respiration in a Next.js app." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content area with your existing Mitochondria simulation */}
          <main className="lg:w-2/3 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Mitochondria Cellular Respiration</h1>
              <Button 
                variant="outline" 
                onClick={() => setShowTutor(!showTutor)}
              >
                {showTutor ? 'Hide AI Tutor' : 'Show AI Tutor'}
              </Button>
            </div>
            
            <div className="w-full bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '500px' }}>
              <MitochondriaSimulation />
            </div>
            
            <div className="mt-8 bg-white p-4 rounded-lg shadow-md w-full">
              <h2 className="text-xl font-bold mb-2">About Cellular Respiration</h2>
              <p className="mb-2">
                Cellular respiration is the process by which cells convert nutrients into adenosine 
                triphosphate (ATP), the energy currency of the cell. This process occurs primarily in 
                the mitochondria, often called the "powerhouse" of the cell.
              </p>
              <p>
                The simulation above demonstrates the three main stages of cellular respiration: 
                glycolysis, the Krebs cycle (or citric acid cycle), and the electron transport chain. 
                Together, these processes efficiently extract energy from glucose molecules to produce 
                ATP that powers cellular activities.
              </p>
            </div>
            
            <footer className="mt-8 text-center text-gray-500 text-sm">
              Powered by Next.js and p5.js
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
};

export default MitochondriaPage;