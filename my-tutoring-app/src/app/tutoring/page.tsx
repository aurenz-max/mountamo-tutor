'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatInterface from '@/components/tutoring/ChatInterface';
import ProblemInterface from '@/components/tutoring/ProblemInterface';
import TutoringInterface from '@/components/tutoring/TutoringInterface';
import SyllabusSelector from '@/components/tutoring/SyllabusSelector';

export default function TutoringPage() {
  const [currentTopic, setCurrentTopic] = useState(null);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">AI Tutor.</h1>
          <h2 className="text-3xl text-gray-500">Learn naturally.</h2>
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
            {currentTopic ? (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100">
                <Tabs defaultValue="chat" className="w-full">
                  <TabsList className="w-full p-2 bg-transparent">
                    <TabsTrigger 
                      value="chat"
                      className="flex-1 rounded-full data-[state=active]:bg-gray-100"
                    >
                      Chat Tutoring
                    </TabsTrigger>
                    <TabsTrigger 
                      value="practice"
                      className="flex-1 rounded-full data-[state=active]:bg-gray-100"
                    >
                      Practice Problems
                    </TabsTrigger>
                    <TabsTrigger 
                      value="live"
                      className="flex-1 rounded-full data-[state=active]:bg-gray-100"
                    >
                      Live Tutoring
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="chat" className="p-6">
                    <ChatInterface 
                      studentId={1}
                      currentTopic={currentTopic}
                    />
                  </TabsContent>
                  
                  <TabsContent value="practice" className="p-6">
                    <ProblemInterface 
                      studentId={1}
                      currentTopic={currentTopic}
                    />
                  </TabsContent>

                  <TabsContent value="live" className="p-6">
                    <TutoringInterface 
                      studentId={1}
                      currentTopic={currentTopic}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 text-center">
                <div className="max-w-md mx-auto">
                  <h3 className="text-xl font-semibold mb-2">Ready to start learning?</h3>
                  <p className="text-gray-500">
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