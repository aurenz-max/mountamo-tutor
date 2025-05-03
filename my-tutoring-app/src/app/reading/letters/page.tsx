'use client';

// pages/language/letter-recognition/page.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from "@/components/ui/button";

// Use dynamic import with SSR disabled for the component
const LetterRecognitionGame = dynamic(() => import('@/components/reading/letters/LetterRecognitionGame'), {
  ssr: false
});

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => 
  import('@/components/GeminiEnhancedTutor').then(mod => mod.default), 
  { ssr: false }
);

export default function LetterRecognitionPage() {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // Letter Recognition Game info with educational metadata
  const simulationInfo = {
    title: 'Letter Recognition Game',
    description: 'An interactive game for kindergarten students to match uppercase and lowercase letters while building letter recognition skills and vocabulary.',
    subject: 'English',
    skill: 'Early Literacy',
    subskill: 'Letter Recognition'
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Letter Recognition Game</title>
        <meta name="description" content="Interactive Letter Recognition Game for Kindergarten" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content area with Letter Recognition Game */}
        <main className="lg:w-2/3 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Letter Recognition Game</h1>
            <Button 
              variant="outline" 
              onClick={() => setShowTutor(!showTutor)}
            >
              {showTutor ? 'Hide AI Helper' : 'Show AI Helper'}
            </Button>
          </div>
          
          <div className="w-full">
            <LetterRecognitionGame />
          </div>
          
          <div className="mt-8 bg-gray-100 p-4 rounded-lg w-full">
            <h2 className="text-xl font-bold mb-2">About Letter Recognition</h2>
            <p className="mb-2">
              Letter recognition is one of the earliest literacy skills that kindergarten students develop. 
              Recognizing that each letter has both an uppercase and lowercase form is essential for 
              reading and writing development.
            </p>
            <p className="mb-2">
              This interactive game helps students practice matching uppercase and lowercase letters in a fun, 
              colorful environment with immediate feedback and reinforcement through example words.
            </p>
            <p>
              As students master letter recognition, they build a foundation for phonics, word recognition, 
              and early reading skills that will support their literacy journey.
            </p>
          </div>
          
          <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Teacher Tips</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>Encourage students to say the letter names out loud as they play</li>
              <li>Have students think of additional words that start with each letter</li>
              <li>For advanced practice, ask students to write the matching letter on paper</li>
              <li>Connect letter recognition to classroom alphabet charts and books</li>
            </ul>
          </div>
          
          <footer className="mt-8 text-center text-gray-500">
            <p>Created for early literacy development</p>
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