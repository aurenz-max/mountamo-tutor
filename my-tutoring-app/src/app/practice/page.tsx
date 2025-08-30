'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SyllabusSelector from '@/components/tutoring/SyllabusSelector';
import ProblemSet from '@/components/practice/ProblemSet';
import { Button } from "@/components/ui/button"; // Fixed import - should be from ui/button
import { ChevronLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const PracticePage = () => {
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoStarted, setAutoStarted] = useState(false);
  
  useEffect(() => {
    // Check if there's a saved practice selection in localStorage
    const savedSelection = localStorage.getItem('selectedPractice');
    
    if (savedSelection) {
      try {
        const parsedSelection = JSON.parse(savedSelection);
        setSelectedTopic(parsedSelection);
        
        // Clear the localStorage item to prevent auto-loading on future visits
        // unless we want to maintain state across page refreshes
        localStorage.removeItem('selectedPractice');
        
        // Set flag to track if we auto-started
        if (parsedSelection.autoStart) {
          setAutoStarted(true);
        }
      } catch (e) {
        console.error('Error parsing saved selection:', e);
      }
    }
    
    setLoading(false);
  }, []);
  
  const handleTopicSelect = (topic) => {
    setSelectedTopic(topic);
  };
  
  const handleBackToSelector = () => {
    setSelectedTopic(null);
    setAutoStarted(false);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Link href="/">
          <Button 
            variant="ghost" 
            className="flex items-center text-gray-600"
          >
            <ChevronLeft className="mr-1" size={16} />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Math Practice</h1>
          <p className="text-gray-500">
            {selectedTopic 
              ? `Working on: ${selectedTopic.skill?.description || selectedTopic.selection.skill || 'Selected Topic'}` 
              : 'Select a topic to practice'}
          </p>
        </div>
      </div>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-600">Loading your practice session...</p>
        </div>
      ) : (
        <>
          {!selectedTopic ? (
            <div className="max-w-xl mx-auto">
              <SyllabusSelector onSelect={handleTopicSelect} />
            </div>
          ) : (
            <div className="space-y-4">
              {autoStarted && (
                <div className="mb-4">
                  <Button
                    onClick={handleBackToSelector}
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Change Topic
                  </Button>
                </div>
              )}
              
              <ProblemSet currentTopic={selectedTopic} numProblems={5} autoStart={selectedTopic.autoStart} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PracticePage;