'use client';

// pages/language/parts-of-speech/page.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from "@/components/ui/button";

// Use dynamic import with SSR disabled for the PartsOfSpeech component
const PartsOfSpeechTutor = dynamic(() => import('@/components/reading/grammar/PartofSpeech'), {
  ssr: false
});

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => 
  import('@/components/GeminiEnhancedTutor').then(mod => mod.default), 
  { ssr: false }
);

export default function PartsOfSpeechPage() {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // Parts of Speech simulation info with educational metadata
  const simulationInfo = {
    title: 'Parts of Speech Tutor',
    description: 'An interactive tool for practicing the identification of different parts of speech in English sentences, including nouns, pronouns, verbs, adjectives, adverbs, prepositions, conjunctions, and interjections.',
    subject: 'English',
    skill: 'Grammar',
    subskill: 'Parts of Speech'
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Parts of Speech Tutor</title>
        <meta name="description" content="Interactive Parts of Speech Learning Tool" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content area with your Parts of Speech component */}
        <main className="lg:w-2/3 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Parts of Speech Tutor</h1>
            <Button 
              variant="outline" 
              onClick={() => setShowTutor(!showTutor)}
            >
              {showTutor ? 'Hide AI Tutor' : 'Show AI Tutor'}
            </Button>
          </div>
          
          <div className="w-full">
            <PartsOfSpeechTutor />
          </div>
          
          <div className="mt-8 bg-gray-100 p-4 rounded-lg w-full">
            <h2 className="text-xl font-bold mb-2">About Parts of Speech</h2>
            <p className="mb-2">
              Parts of speech are categories of words defined by their role in a sentence. Understanding parts of speech is 
              fundamental to mastering English grammar, writing clearly, and analyzing text.
            </p>
            <p>
              The eight main parts of speech in English are: nouns, pronouns, verbs, adjectives, adverbs, prepositions, 
              conjunctions, and interjections. Each plays a specific role in constructing meaningful sentences.
            </p>
          </div>
          
          <footer className="mt-8 text-center text-gray-500">
            <p>Created with Next.js and React</p>
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