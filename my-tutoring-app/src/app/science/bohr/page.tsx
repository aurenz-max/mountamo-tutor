'use client';

// pages/science/bohr/page.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from "@/components/ui/button";

// Use dynamic import with SSR disabled for Three.js component
// This avoids errors related to window/document not being available during server-side rendering
const BohrModel = dynamic(() => import('@/components/science/bohr/BohrModel'), {
  ssr: false
});

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => import('@/components/GeminiEnhancedTutor'), {
  ssr: false
});

export default function BohrModelPage() {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // Bohr model simulation info with educational metadata
  const simulationInfo = {
    title: 'Bohr Model of the Atom',
    description: 'An interactive 3D visualization of the Bohr model showing electrons orbiting around a nucleus with protons and neutrons. The model demonstrates basic atomic structure and electron energy levels.',
    subject: 'Chemistry',
    skill: 'Atomic Structure',
    subskill: 'Bohr Model'
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>3D Bohr Model</title>
        <meta name="description" content="Interactive 3D Bohr Model of Atoms" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content area with your existing Bohr model */}
        <main className="lg:w-2/3 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">3D Bohr Model of the Atom</h1>
            <Button 
              variant="outline" 
              onClick={() => setShowTutor(!showTutor)}
            >
              {showTutor ? 'Hide AI Tutor' : 'Show AI Tutor'}
            </Button>
          </div>
          
          <div className="w-full">
            <BohrModel />
          </div>
          
          <div className="mt-8 bg-gray-100 p-4 rounded-lg w-full">
            <h2 className="text-xl font-bold mb-2">About the Bohr Model</h2>
            <p className="mb-2">
              The Bohr model, developed by Niels Bohr in 1913, depicts the atom as a small, positively charged nucleus 
              surrounded by electrons that travel in circular orbits around the nucleus—similar to the structure of the Solar System.
            </p>
            <p>
              While the model has been superseded by more accurate representations based on quantum mechanics, 
              the Bohr model is still useful for visualizing the basic structure of atoms and understanding 
              fundamental concepts in chemistry and physics.
            </p>
          </div>
          
          <footer className="mt-8 text-center text-gray-500">
            <p>Created with Next.js, React, and Three.js</p>
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
  );
}