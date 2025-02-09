'use client'

import { useState } from 'react';
import TutoringInterface from '@/components/tutoring/TutoringInterface';
import SyllabusSelector from '@/components/tutoring/SyllabusSelector';

export default function TutoringPage() {
  const [currentTopic, setCurrentTopic] = useState(null);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container max-w-[1600px] mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8 lg:mb-12">
          <h1 className="text-4xl font-semibold">AI Tutor.</h1>
          <h2 className="text-4xl text-gray-500">Learn naturally.</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Syllabus Panel */}
          <div className="lg:col-span-3">
            <div className="sticky top-4">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <SyllabusSelector 
                  onSelect={setCurrentTopic}
                  currentSelection={currentTopic}
                />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9">
            {currentTopic ? (
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                <TutoringInterface 
                  studentId={1}
                  currentTopic={currentTopic}
                />
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 lg:p-16 shadow-sm border border-gray-100 text-center">
                <div className="max-w-md mx-auto">
                  <h3 className="text-2xl font-semibold mb-3">Ready to start learning?</h3>
                  <p className="text-gray-500 text-lg">
                    Select a topic from the curriculum to begin your personalized learning journey
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}