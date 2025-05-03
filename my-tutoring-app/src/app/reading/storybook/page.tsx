'use client';

// pages/language-arts/storybook/page.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from "@/components/ui/button";

// Import the StoryBookGenerator component 
import StoryBookGenerator from '@/components/reading/storybook/StoryBookGenerator';

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => 
  import('@/components/GeminiEnhancedTutor').then(mod => mod.default), 
  { ssr: false }
);

export default function InteractiveStoryBookPage() {
  // State to toggle AI Tutor visibility
  const [showTutor, setShowTutor] = useState(true);
  
  // StoryBook generator info with educational metadata
  const simulationInfo = {
    title: 'Interactive Storybook Generator',
    description: 'A tool that creates engaging, interactive storybooks for young readers. The generator produces age-appropriate content with customizable characters, themes, and educational focus to support reading development.',
    subject: 'Language Arts',
    skill: 'Reading Comprehension',
    subskill: 'Interactive Storytelling'
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Interactive Storybook Generator</title>
        <meta name="description" content="Create custom interactive storybooks for young readers" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content area with your StoryBook generator */}
        <main className="lg:w-2/3 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Interactive Storybook Generator</h1>
            <Button 
              variant="outline" 
              onClick={() => setShowTutor(!showTutor)}
            >
              {showTutor ? 'Hide AI Tutor' : 'Show AI Tutor'}
            </Button>
          </div>
          
          <div className="w-full">
            <StoryBookGenerator />
          </div>
          
          <div className="mt-8 bg-gray-100 p-4 rounded-lg w-full">
            <h2 className="text-xl font-bold mb-2">About Interactive Storybooks</h2>
            <p className="mb-2">
              Interactive storybooks engage young readers by combining narrative text with responsive elements that react 
              to a child's input. These digital books help develop reading skills by creating an immersive experience that 
              reinforces comprehension and vocabulary acquisition.
            </p>
            <p>
              Research shows that interactive reading experiences can significantly improve reading motivation, 
              comprehension, and retention for early readers. By adding elements like touch interactions, sound effects, 
              and comprehension activities, young readers can develop stronger connections to the text.
            </p>
          </div>
          
          <footer className="mt-8 text-center text-gray-500">
            <p>Created with Next.js, React, and Gemini AI</p>
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