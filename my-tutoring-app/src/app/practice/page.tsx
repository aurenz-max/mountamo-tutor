'use client';

import { useState } from 'react';
import { WebSocketProvider } from '@/lib/use-websocket';
import ProblemInterface from '@/components/tutoring/ProblemInterface';
import SyllabusSelector from '@/components/tutoring/SyllabusSelector';
import GeminiAudioPlayer from '@/components/tutoring/GeminiAudioPlayer';

export default function PracticePage() {
  const [currentTopic, setCurrentTopic] = useState(null);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Practice Mode.</h1>
          <h2 className="text-3xl text-gray-500">Master concepts.</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Syllabus Panel */}
          <div className="lg:col-span-4">
            <div className="sticky top-4">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <SyllabusSelector
                  onSelect={setCurrentTopic}
                  currentSelection={currentTopic}
                />
              </div>
            </div>
          </div>
          
          {/* Main Content Panel */}
          <div className="lg:col-span-8">
            <WebSocketProvider>
              {currentTopic ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <ProblemInterface
                      studentId={1}
                      currentTopic={currentTopic}
                    />
                  </div>
                  <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
                    <GeminiAudioPlayer />
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 text-center">
                  <div className="max-w-md mx-auto">
                    <h3 className="text-xl font-semibold mb-2">Ready to practice?</h3>
                    <p className="text-gray-500">
                      Select a topic from the curriculum to start solving problems
                    </p>
                  </div>
                </div>
              )}
            </WebSocketProvider>
          </div>
        </div>
      </div>
    </main>
  );
}