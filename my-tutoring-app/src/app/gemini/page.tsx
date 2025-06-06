// Add this debugging version temporarily to see what's happening

'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import SyllabusSelector from '@/components/gemini-tutor/SyllabusSelector';
// Make sure this import path is correct for your project structure
import ContentPackageSelector from '@/components/gemini-tutor/ContentPackageSelector';
import GeminiTutoringSession from '@/components/gemini-tutor/GeminiTutoringSession';
import { 
  BookOpen, Sparkles, Rocket, Palette, MessageSquare, 
  Monitor, ChevronRight, Star, Zap, Trophy, Mic,
  PlusCircle, FolderOpen, Code, RefreshCw, Save, Package
} from 'lucide-react';

// Types
interface CurriculumSelection {
  subject: string;
  unit?: { id: string; title: string; };
  skill?: { id: string; description: string; };
  subskill?: { id: string; description: string; difficulty_range?: { start: number; end: number; target: number; }; };
}

type LearningMode = 'select' | 'general' | 'package-selection' | 'creative-coding' | 'creative-coding-choice' | 'creative-coding-saved' | 'code-editor-only';

export default function TutoringPage() {
  // State for curriculum selection
  const [curriculumSelection, setCurriculumSelection] = useState<CurriculumSelection | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState('8-10');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [learningMode, setLearningMode] = useState<LearningMode>('select');
  
  const studentId = 1001;

  // DEBUG: Log state changes
  useEffect(() => {
    console.log('🔍 DEBUG - Learning Mode:', learningMode);
    console.log('🔍 DEBUG - Curriculum Selection:', curriculumSelection);
    console.log('🔍 DEBUG - Is Session Active:', isSessionActive);
    console.log('🔍 DEBUG - Selected Package ID:', selectedPackageId);
  }, [learningMode, curriculumSelection, isSessionActive, selectedPackageId]);
  
  // Handles curriculum selection from SyllabusSelector
  const handleCurriculumSelection = (selectedData: any) => {
    console.log('🎯 DEBUG - Curriculum selected:', selectedData);
    
    const transformedSelection: CurriculumSelection = {
      subject: selectedData.subject || selectedData.selectedSubject,
      unit: selectedData.unit,
      skill: selectedData.skill,
      subskill: selectedData.subskill,
    };
    
    console.log('🎯 DEBUG - Transformed selection:', transformedSelection);
    
    setCurriculumSelection(transformedSelection);
    // This should trigger the package selection screen
    setLearningMode('package-selection');
    console.log('🎯 DEBUG - Set learning mode to package-selection');
  };

  // Handle content package selection
  const handlePackageSelection = (packageId: string | null) => {
    console.log('📦 DEBUG - Package selected:', packageId);
    setSelectedPackageId(packageId);
    setIsSessionActive(true);
    setLearningMode('general');
  };

  // Go back from package selection to curriculum selection
  const handleBackFromPackages = () => {
    console.log('⬅️ DEBUG - Going back from packages');
    setLearningMode('general');
    setSelectedPackageId(null);
  };
  
  // End the current session
  const handleEndSession = () => {
    setIsSessionActive(false);
    setLearningMode('select');
    setCurriculumSelection(null);
    setSelectedPackageId(null);
  };
  
  // Reset selection to create a new session
  const handleNewSession = () => {
    setCurriculumSelection(null);
    setSelectedPackageId(null);
    setIsSessionActive(false);
    setLearningMode('select');
  };

  // DEBUG: Add a button to manually test package selection
  const handleDebugPackageSelection = () => {
    console.log('🧪 DEBUG - Manually triggering package selection');
    setCurriculumSelection({
      subject: 'Mathematics',
      skill: { id: 'algebra', description: 'Algebra Basics' },
      subskill: { id: 'linear-equations', description: 'Linear Equations' }
    });
    setLearningMode('package-selection');
  };

  // If we're in a session, show the appropriate component
  if (isSessionActive && curriculumSelection) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              Tutoring Session: {curriculumSelection.subject}
              {curriculumSelection.skill && ` - ${curriculumSelection.skill.description}`}
            </h2>
            {selectedPackageId && (
              <div className="flex items-center gap-2 mt-2">
                <Package className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-purple-600 font-medium">Enhanced Content Session</span>
              </div>
            )}
          </div>
          <button 
            className="py-2 px-4 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition-colors"
            onClick={handleNewSession}
          >
            New Session
          </button>
        </div>
        
        <GeminiTutoringSession 
          initialCurriculum={{
            subject: curriculumSelection.subject,
            domain: curriculumSelection.unit,
            skill: curriculumSelection.skill,
            subskill: curriculumSelection.subskill,
          }}
          ageGroup={ageGroup}
          packageId={selectedPackageId}
          studentId={studentId}
          onSessionEnd={handleEndSession}
        />
      </div>
    );
  }

  // Package selection screen
  if (learningMode === 'package-selection' && curriculumSelection) {
    console.log('📦 DEBUG - Rendering package selection screen');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Head>
          <title>Choose Enhanced Content - {curriculumSelection.subject}</title>
        </Head>
        
        <main className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-3 mb-4">
              <Package className="w-10 h-10 text-purple-600" />
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Enhanced Learning
              </h1>
            </div>
            <p className="text-lg text-gray-600">Choose your content package for {curriculumSelection.subject}</p>
            
            {/* DEBUG INFO */}
            <div className="mt-4 p-4 bg-yellow-100 rounded-lg text-left text-sm">
              <h3 className="font-bold">🔍 DEBUG INFO:</h3>
              <p>Learning Mode: {learningMode}</p>
              <p>Curriculum: {JSON.stringify(curriculumSelection)}</p>
              <p>Package ID: {selectedPackageId || 'None'}</p>
            </div>
          </div>
          
          <div className="max-w-4xl mx-auto">
            {/* Back button */}
            <button 
              onClick={handleBackFromPackages}
              className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              <span>Back to curriculum selection</span>
            </button>
            
            {/* Content Package Selector */}
            <ContentPackageSelector
              curriculum={curriculumSelection}
              ageGroup={ageGroup}
              onSelect={handlePackageSelection}
              selectedPackageId={selectedPackageId}
            />
          </div>
        </main>
      </div>
    );
  }
  
  // Landing page with mode selection
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Head>
        <title>AI Learning Adventure - Choose Your Path!</title>
        <meta name="description" content="Interactive tutoring sessions aligned with curriculum standards" />
      </Head>
      
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* DEBUG PANEL */}
        <div className="mb-4 p-4 bg-yellow-100 rounded-lg">
          <h3 className="font-bold text-yellow-800">🔍 DEBUG PANEL</h3>
          <p className="text-sm text-yellow-700">Learning Mode: {learningMode}</p>
          <p className="text-sm text-yellow-700">Curriculum: {curriculumSelection ? 'Selected' : 'None'}</p>
          <button 
            onClick={handleDebugPackageSelection}
            className="mt-2 px-3 py-1 bg-yellow-500 text-white rounded text-sm"
          >
            🧪 Test Package Selection
          </button>
        </div>

        {/* Fun header with animation */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-3 mb-4">
            <Rocket className="w-10 h-10 text-purple-600 animate-bounce" />
            <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Learning Adventure
            </h1>
            <Star className="w-10 h-10 text-yellow-500 animate-pulse" />
          </div>
          <p className="text-lg text-gray-600">Choose how you want to learn today!</p>
        </div>
        
        {learningMode === 'select' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* General Tutoring Card */}
            <div 
              onClick={() => {
                console.log('🎯 DEBUG - Subject Tutoring clicked');
                setLearningMode('general');
              }}
              className="bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all cursor-pointer transform hover:scale-105 p-8 border-4 border-blue-100 hover:border-blue-300"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-blue-100 rounded-2xl">
                  <BookOpen className="w-12 h-12 text-blue-600" />
                </div>
                <ChevronRight className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-gray-800">
                Subject Tutoring
              </h2>
              <p className="text-gray-600 mb-4">
                Learn math, science, language arts, and more with your AI tutor!
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  📚 All Subjects
                </span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  🎯 Curriculum Aligned
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                  🗣️ Voice Chat
                </span>
                <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-sm font-medium border border-purple-200">
                  ✨ Enhanced Content
                </span>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Interactive lessons
                </li>
                <li className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  Ask questions anytime
                </li>
                <li className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-500" />
                  Rich multimedia content
                </li>
                <li className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-purple-500" />
                  Track your progress
                </li>
              </ul>
            </div>
            
            {/* Other cards... */}
            <div className="bg-white rounded-3xl shadow-lg p-8 border-4 border-gray-100">
              <h2 className="text-2xl font-bold mb-3 text-gray-800">Creative Coding</h2>
              <p className="text-gray-600">Coming soon...</p>
            </div>
            
            <div className="bg-white rounded-3xl shadow-lg p-8 border-4 border-gray-100">
              <h2 className="text-2xl font-bold mb-3 text-gray-800">Code Editor</h2>
              <p className="text-gray-600">Coming soon...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Back button */}
            <button 
              onClick={() => setLearningMode('select')}
              className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              <span>Back to learning modes</span>
            </button>
            
            {/* Setup interface */}
            <div className="bg-white rounded-3xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">
                📚 Set Up Your Tutoring Session
              </h2>
              
              {/* Age selection */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">
                  How old are you? 🎂
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { range: '5-7', emoji: '🧸', color: 'blue' },
                    { range: '8-10', emoji: '🚀', color: 'green' },
                    { range: '11-13', emoji: '⚡', color: 'purple' },
                    { range: '14-16', emoji: '🎯', color: 'orange' }
                  ].map(({ range, emoji, color }) => (
                    <button
                      key={range}
                      className={`py-3 px-4 rounded-xl text-lg font-medium transition-all ${
                        ageGroup === range
                          ? `bg-${color}-100 border-3 border-${color}-300 text-${color}-700 shadow-md scale-105`
                          : 'bg-gray-100 border-2 border-gray-200 text-gray-600 hover:bg-gray-200'
                      }`}
                      onClick={() => setAgeGroup(range)}
                    >
                      <span className="text-2xl mb-1 block">{emoji}</span>
                      {range} years
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Curriculum selection */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">
                  What do you want to learn? 🎯
                </h3>
                <SyllabusSelector onSelect={handleCurriculumSelection} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}