// 1. Update your TutoringPage component (page.tsx)
'use client'

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import TutoringInterface from '@/components/tutoring/TutoringInterface';
import SyllabusSelector from '@/components/tutoring/SyllabusSelector';
import AvatarIntegration from '@/components/avatar/AvatarIntegration';

export default function TutoringPage() {
  const [currentTopic, setCurrentTopic] = useState(null);
  const [avatarVisible, setAvatarVisible] = useState(true);

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container max-w-[1600px] mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8 lg:mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-semibold text-gray-800">AI Tutor.</h1>
            <h2 className="text-2xl text-gray-600">Learn naturally.</h2>
          </div>
          
          {/* Avatar toggle button */}
          <button 
            onClick={() => setAvatarVisible(!avatarVisible)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50 
                      rounded-md transition-colors border border-gray-200 shadow-sm"
            aria-label={avatarVisible ? "Hide avatar" : "Show avatar"}
          >
            {avatarVisible ? (
              <>
                <EyeOff size={16} />
                <span>Hide Avatar</span>
              </>
            ) : (
              <>
                <Eye size={16} />
                <span>Show Avatar</span>
              </>
            )}
          </button>
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
                <TutoringInterface 
                  studentId={1}
                  currentTopic={currentTopic}
                />
              ) : (
                <div className="p-12 text-center">
                  <div className="max-w-md mx-auto">
                    <h3 className="text-2xl font-semibold mb-3 text-gray-800">Ready to start learning?</h3>
                    <p className="text-gray-600 text-lg">
                      Select a topic from the curriculum to begin your personalized learning journey
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Avatar Integration - conditionally rendered based on avatarVisible state */}
      {avatarVisible && <AvatarIntegration />}
    </main>
  );
}