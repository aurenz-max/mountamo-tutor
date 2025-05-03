'use client';

// pages/games/counting/page.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from "@/components/ui/button";

// Use dynamic import with SSR disabled for p5.js component
// This avoids errors related to window/document not being available during server-side rendering
const CountingCirclesGame = dynamic(() => import('@/components/math/counting/CountingCirclesGame'), {
  ssr: false
});

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => 
  import('@/components/GeminiEnhancedTutor').then(mod => mod.default), 
  { ssr: false }
);

export default function CountingCirclesPage() {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // Counting game info with educational metadata
  const gameInfo = {
    title: 'Counting Circles Game',
    description: 'An interactive game that helps develop counting skills and number recognition through visual patterns. Players need to identify the correct number of circles shown on screen, with adjustable difficulty levels.',
    subject: 'Mathematics',
    skill: 'Counting and Cardinality',
    subskill: 'Counting and Subitizing'
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Counting Circles Game</title>
        <meta name="description" content="Interactive Counting Game for Number Recognition" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content area with counting game */}
        <main className="lg:w-2/3 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Counting Circles Game</h1>
            <Button 
              variant="outline" 
              onClick={() => setShowTutor(!showTutor)}
            >
              {showTutor ? 'Hide AI Tutor' : 'Show AI Tutor'}
            </Button>
          </div>
          
          <div className="w-full bg-white rounded-lg shadow-md overflow-hidden">
            <CountingCirclesGame />
          </div>
          
          <div className="mt-8 bg-gray-100 p-4 rounded-lg w-full">
            <h2 className="text-xl font-bold mb-2">About the Game</h2>
            <p className="mb-2">
              This counting game is designed to help develop important mathematical skills like number recognition,
              subitizing (recognizing quantities without counting), and visual pattern recognition.
            </p>
            <p>
              Players can choose between three difficulty levels that adjust both the number range and the 
              visual complexity of the challenge. This progression helps build mathematical confidence and fluency
              with numbers across different contexts.
            </p>
          </div>
          
          <footer className="mt-8 text-center text-gray-500">
            <p>Created with Next.js, React, and p5.js</p>
          </footer>
        </main>
        
        {/* AI Tutor panel */}
        {showTutor && (
          <div className="lg:w-1/3">
            <EnhancedGeminiTutor
              simulationTitle={gameInfo.title}
              simulationDescription={gameInfo.description}
              subject={gameInfo.subject}
              skill={gameInfo.skill}
              subskill={gameInfo.subskill}
              className="sticky top-6 max-h-[calc(100vh-3rem)]"
            />
          </div>
        )}
      </div>
    </div>
  );
}