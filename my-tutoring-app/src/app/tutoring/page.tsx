'use client'

import { useState } from 'react';
import TutoringInterface from '@/components/tutoring/TutoringInterface';
import SyllabusSelector from '@/components/tutoring/SyllabusSelector';

export default function TutoringPage() {
  const [currentTopic, setCurrentTopic] = useState(null);
  
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container max-w-[1600px] mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8 lg:mb-12">
          <h1 className="text-4xl font-semibold text-gray-800">AI Tutor.</h1>
          <h2 className="text-2xl text-gray-600">Learn naturally.</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar (Syllabus) */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 h-[calc(100vh-200px)] overflow-y-auto">
              <div className="bg-white rounded-3xl p-6 shadow-md border border-gray-200">
                <SyllabusSelector 
                  onSelect={setCurrentTopic}
                  currentSelection={currentTopic}
                />
              </div>
            </div>
          </div>

          {/* Main Content (Interactive Workspace) */}
          <div className="lg:col-span-3 relative">
            <div className="bg-white rounded-3xl overflow-hidden shadow-md border border-gray-200 h-[calc(100vh-150px)]">
              {currentTopic ? (
                <div className="h-full">
                  <TutoringInterface 
                    studentId={1}
                    currentTopic={currentTopic}
                  />
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="max-w-md mx-auto">
                    <h3 className="text-2xl font-semibold mb-3 text-gray-800">Ready to start learning?</h3>
                    <p className="text-gray-600 text-lg">
                      Select a topic from the curriculum to begin your personalized learning journey with your animated tutor.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}