'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import SyllabusSelector from '@/components/gemini-tutor/SyllabusSelector';
import GeminiTutoringSession from '@/components/gemini-tutor/GeminiTutoringSession';
import P5jsTutoringSession from '@/components/gemini-tutor/P5jsTutoringSession';
import P5jsCodeEditorScreen from '@/components/gemini-tutor/P5jsCodeEditor';
import SnippetManager from '@/components/playground/SnippetManager';
import { 
  BookOpen, Sparkles, Rocket, Palette, MessageSquare, 
  Monitor, ChevronRight, Star, Zap, Trophy, Mic,
  PlusCircle, FolderOpen, Code, RefreshCw, Save // Add RefreshCw and Save
} from 'lucide-react';
import { useSnippets } from '@/components/playground/hooks/useSnippets';
import { type CodeSnippet } from '@/lib/playground-api';

// Types
interface CurriculumSelection {
  subject: string;
  unit?: {
    id: string;
    title: string;
  };
  skill?: {
    id: string;
    description: string;
  };
  subskill?: {
    id: string;
    description: string;
    difficulty_range?: {
      start: number;
      end: number;
      target: number;
    };
  };
}

type LearningMode = 'select' | 'general' | 'creative-coding' | 'creative-coding-choice' | 'creative-coding-saved' | 'code-editor-only';

export default function TutoringPage() {
  // State for curriculum selection
  const [curriculumSelection, setCurriculumSelection] = useState<CurriculumSelection | null>(null);
  const [ageGroup, setAgeGroup] = useState('8-10');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [learningMode, setLearningMode] = useState<LearningMode>('select');
  const [selectedSnippetCode, setSelectedSnippetCode] = useState<string | null>(null);
  
  // Mock student ID - replace with actual student ID from your auth system
  const studentId = 1001;
  
  // Snippet management hooks
  const snippetHooks = useSnippets(
    studentId,
    '', // currentCode - not needed here
    async () => {}, // updateCode - not needed here
    (role, message) => console.log(`${role}: ${message}`) // addSystemMessage
  );
  
  // Load snippets when entering creative coding mode
  useEffect(() => {
    if (learningMode === 'creative-coding-saved' || learningMode === 'code-editor-only') {
      snippetHooks.loadSnippets();
    }
  }, [learningMode]);
  
  // Handles curriculum selection from SyllabusSelector
  const handleCurriculumSelection = (selectedData: any) => {
    const transformedSelection: CurriculumSelection = {
      subject: selectedData.subject || selectedData.selectedSubject,
      unit: selectedData.unit,
      skill: selectedData.skill,
      subskill: selectedData.subskill,
    };
    
    setCurriculumSelection(transformedSelection);
    setIsSessionActive(true);
  };
  
  // Handle loading a saved snippet
  const handleLoadSnippet = async (snippet: CodeSnippet) => {
    // Set the selected snippet's code
    setSelectedSnippetCode(snippet.code);
    
    // Transform snippet metadata into curriculum selection
    // Use the snippet's actual title and description as the primary identifiers
    const curriculumFromSnippet: CurriculumSelection = {
      subject: 'P5.js Creative Coding',
      unit: snippet.unit_id ? {
        id: snippet.unit_id,
        title: snippet.unit_title || snippet.title
      } : {
        id: 'custom',
        title: snippet.title
      },
      skill: snippet.skill_id ? {
        id: snippet.skill_id,
        description: snippet.skill_description || snippet.title
      } : {
        id: 'custom',
        description: snippet.title
      },
      subskill: snippet.subskill_id ? {
        id: snippet.subskill_id,
        description: snippet.subskill_description || snippet.description || ''
      } : snippet.description ? {
        id: 'custom',
        description: snippet.description
      } : undefined,
    };
    
    setCurriculumSelection(curriculumFromSnippet);
    setIsSessionActive(true);
    return true;
  };
  
  // End the current session
  const handleEndSession = () => {
    setIsSessionActive(false);
    setLearningMode('select');
    setCurriculumSelection(null);
    setSelectedSnippetCode(null);
  };
  
  // Reset selection to create a new session
  const handleNewSession = () => {
    setCurriculumSelection(null);
    setIsSessionActive(false);
    setLearningMode('select');
    setSelectedSnippetCode(null);
  };
  
  // If we're in a session, show the appropriate component
  if (isSessionActive && curriculumSelection) {
    if (learningMode === 'creative-coding' || learningMode === 'creative-coding-saved') {
      return (
        <P5jsTutoringSession 
          initialCurriculum={{
            subject: curriculumSelection.subject,
            domain: curriculumSelection.unit,
            skill: curriculumSelection.skill,
            subskill: curriculumSelection.subskill,
          }}
          ageGroup={ageGroup}
          onSessionEnd={handleEndSession}
          initialCode={selectedSnippetCode || undefined}
        />
      );
    } else if (learningMode === 'code-editor-only') {
      return (
        <P5jsCodeEditorScreen
          initialCode={selectedSnippetCode || undefined}
          studentId={studentId}
          onExit={handleEndSession}
        />
      );
    } else {
      return (
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">
              Tutoring Session: {curriculumSelection.subject}
              {curriculumSelection.skill && ` - ${curriculumSelection.skill.description}`}
            </h2>
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
            onSessionEnd={handleEndSession}
          />
        </div>
      );
    }
  }
  
  // Creative coding choice screen
  if (learningMode === 'creative-coding-choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Head>
          <title>Creative Coding - Choose Your Path!</title>
        </Head>
        
        <main className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center mb-12">
            <div className="flex justify-center items-center gap-3 mb-4">
              <Palette className="w-10 h-10 text-purple-600 animate-bounce" />
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Creative Coding Studio
              </h1>
            </div>
            <p className="text-lg text-gray-600">Start a new project or continue where you left off!</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Create New Project */}
            <div 
              onClick={() => setLearningMode('creative-coding')}
              className="bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all cursor-pointer transform hover:scale-105 p-8 border-4 border-green-100 hover:border-green-300"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-green-100 rounded-2xl">
                  <PlusCircle className="w-12 h-12 text-green-600" />
                </div>
                <ChevronRight className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-gray-800">
                New Project
              </h2>
              <p className="text-gray-600 mb-4">
                Start fresh with a new creative coding project
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Choose from curriculum topics
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Get guided tutorials
                </li>
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-blue-500" />
                  Save your creations
                </li>
              </ul>
            </div>
            
            {/* Code Editor Only */}
            <div 
              onClick={() => {
                setCurriculumSelection({
                  subject: 'Code Editor',
                  unit: { id: 'editor', title: 'Code Editor' },
                  skill: { id: 'coding', description: 'P5.js Coding' }
                });
                setLearningMode('code-editor-only');
                setIsSessionActive(true);
              }}
              className="bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all cursor-pointer transform hover:scale-105 p-8 border-4 border-indigo-100 hover:border-indigo-300"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-indigo-100 rounded-2xl">
                  <Code className="w-12 h-12 text-indigo-600" />
                </div>
                <ChevronRight className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-gray-800">
                Code Editor
              </h2>
              <p className="text-gray-600 mb-4">
                Pure coding experience with no AI assistance
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-indigo-500" />
                  Distraction-free coding
                </li>
                <li className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-500" />
                  Instant preview
                </li>
                <li className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-green-500" />
                  Run and test your code
                </li>
              </ul>
            </div>
            
            {/* Load Saved Projects */}
            <div 
              onClick={() => setLearningMode('creative-coding-saved')}
              className="bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all cursor-pointer transform hover:scale-105 p-8 border-4 border-blue-100 hover:border-blue-300"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-blue-100 rounded-2xl">
                  <FolderOpen className="w-12 h-12 text-blue-600" />
                </div>
                <ChevronRight className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-gray-800">
                My Projects
              </h2>
              <p className="text-gray-600 mb-4">
                Continue working on your saved sketches
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-500" />
                  Access saved sketches
                </li>
                <li className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-purple-500" />
                  Track your progress
                </li>
                <li className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-green-500" />
                  Continue where you left off
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <button
              onClick={() => setLearningMode('select')}
              className="text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2 mx-auto"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              Back to learning modes
            </button>
          </div>
        </main>
      </div>
    );
  }
  
  // Saved sketches screen
  if (learningMode === 'creative-coding-saved') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Head>
          <title>My Creative Coding Projects</title>
        </Head>
        
        <main className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">My Creative Coding Projects</h1>
            <p className="text-gray-600">Select a project to continue working on it</p>
          </div>
          
          <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-lg p-6">
            <div className="mb-4 flex justify-between items-center">
              <button
                onClick={() => setLearningMode('creative-coding-choice')}
                className="text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
                Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCurriculumSelection({
                      subject: 'Code Editor',
                      unit: { id: 'editor', title: 'Code Editor' },
                      skill: { id: 'coding', description: 'P5.js Coding' }
                    });
                    setLearningMode('code-editor-only');
                    setIsSessionActive(true);
                  }}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Code className="w-5 h-5" />
                  Code Editor
                </button>
                <button
                  onClick={() => setLearningMode('creative-coding')}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  New Project
                </button>
              </div>
            </div>
            
            <SnippetManager
              snippets={snippetHooks.snippets}
              isLoading={snippetHooks.isLoading}
              onRefresh={snippetHooks.loadSnippets}
              onLoad={handleLoadSnippet}
              onEdit={snippetHooks.editSnippet}
              onDelete={snippetHooks.deleteSnippet}
              onCreateNew={() => setLearningMode('creative-coding')}
            />
          </div>
          
          {snippetHooks.renderSaveDialog()}
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
              onClick={() => setLearningMode('general')}
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
                  <Trophy className="w-4 h-4 text-purple-500" />
                  Track your progress
                </li>
              </ul>
            </div>
            
            {/* Creative Coding Card */}
            <div 
              onClick={() => setLearningMode('creative-coding-choice')}
              className="bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all cursor-pointer transform hover:scale-105 p-8 border-4 border-purple-100 hover:border-purple-300"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-purple-100 rounded-2xl">
                  <Palette className="w-12 h-12 text-purple-600" />
                </div>
                <ChevronRight className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-gray-800">
                Creative Coding
              </h2>
              <p className="text-gray-600 mb-4">
                Create art, animations, and games while learning to code!
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                  🎨 P5.js Art
                </span>
                <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm">
                  ✨ Interactive
                </span>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                  🚀 Fun Projects
                </span>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Create animations
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Learn by doing
                </li>
                <li className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-500" />
                  See instant results
                </li>
              </ul>
            </div>
            
            {/* Code Editor Card */}
            <div 
              onClick={() => {
                setCurriculumSelection({
                  subject: 'Code Editor',
                  unit: { id: 'editor', title: 'Code Editor' },
                  skill: { id: 'coding', description: 'P5.js Coding' }
                });
                setLearningMode('code-editor-only');
                setIsSessionActive(true);
              }}
              className="bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all cursor-pointer transform hover:scale-105 p-8 border-4 border-indigo-100 hover:border-indigo-300"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-indigo-100 rounded-2xl">
                  <Code className="w-12 h-12 text-indigo-600" />
                </div>
                <ChevronRight className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-gray-800">
                Code Editor Only
              </h2>
              <p className="text-gray-600 mb-4">
                Focused coding experience without AI assistance
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                  💻 P5.js Coding
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  🔍 Focused
                </span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  🚀 No Distractions
                </span>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-indigo-500" />
                  Pure coding experience
                </li>
                <li className="flex items-center gap-2">
                  <Save className="w-4 h-4 text-blue-500" />
                  Save your sketches
                </li>
                <li className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-green-500" />
                  Real-time preview
                </li>
              </ul>
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
                {learningMode === 'creative-coding' 
                  ? '🎨 Set Up Your Creative Coding Session' 
                  : '📚 Set Up Your Tutoring Session'}
              </h2>
              
              {/* Age selection with fun styling */}
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
              
              {/* Start button */}
              {curriculumSelection && (
                <div className="text-center mt-8">
                  <button
                    onClick={() => setIsSessionActive(true)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xl font-bold py-4 px-8 rounded-xl hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 transition-all shadow-lg flex items-center gap-3 mx-auto"
                  >
                    <Rocket className="w-6 h-6" />
                    Start Learning Adventure!
                  </button>
                </div>
              )}
            </div>
            
            {/* Tips section with fun styling */}
            <div className="mt-8 bg-white rounded-3xl shadow-lg p-8">
              <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                <Star className="w-6 h-6 text-yellow-500" />
                Tips for an Amazing Session
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {learningMode === 'creative-coding' ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Be Creative!</h4>
                        <p className="text-sm text-gray-600">Try changing colors, shapes, and movements</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Zap className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Experiment Freely</h4>
                        <p className="text-sm text-gray-600">There's no wrong way to create art with code</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Trophy className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Save Your Work</h4>
                        <p className="text-sm text-gray-600">You can save your favorite creations</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-pink-100 rounded-lg">
                        <MessageSquare className="w-5 h-5 text-pink-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Ask Questions</h4>
                        <p className="text-sm text-gray-600">Your AI friend loves helping with code</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Mic className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Speak Clearly</h4>
                        <p className="text-sm text-gray-600">Find a quiet spot for better voice recognition</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <MessageSquare className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Ask Questions</h4>
                        <p className="text-sm text-gray-600">No question is too small or silly!</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Monitor className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Share Your Screen</h4>
                        <p className="text-sm text-gray-600">Show your work to get better help</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Star className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Have Fun!</h4>
                        <p className="text-sm text-gray-600">Learning is an adventure</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}