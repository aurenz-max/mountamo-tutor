'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookOpen, Volume2, Settings2, Sparkles, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import webSocketService from '@/lib/WebSocketService';

// Interface for a read-along part (either text or image)
interface ReadAlongPart {
  text?: string;
  image_base64?: string;
  mime_type?: string;
}

// Interface for read-along content
interface ReadAlongContent {
  id: string;
  type: string;
  session_id: string;
  reading_instructions: string;
  parts: ReadAlongPart[];
  title?: string;
  reading_level?: number;
}

// Popular subjects for kids
const popularSubjects = [
  { 
    id: 'dinosaurs', 
    name: 'Dinosaurs', 
    icon: '🦖',
    themes: ['T-Rex', 'Triceratops', 'Pterodactyl']
  },
  { 
    id: 'construction', 
    name: 'Construction', 
    icon: '🚜',
    themes: ['Construction site', 'Bulldozers', 'Cranes', 'Backhoes']
  },
  { 
    id: 'space', 
    name: 'Space', 
    icon: '🚀',
    themes: ['Astronauts', 'Planets', 'Space travel','Venus','Mars']
  },
  { 
    id: 'animals', 
    name: 'Animals', 
    icon: '🦁',
    themes: ['Zoo animals', 'Ocean creatures', 'Forest animals']
  },
  { 
    id: 'superheroes', 
    name: 'Superheroes', 
    icon: '🦸',
    themes: ['Super strength', 'Flying heroes', 'Saving the day']
  }
];

interface ReadAlongPageProps {
  studentId?: number | null;
  currentTopic?: any;
}

const ReadAlongPage: React.FC<ReadAlongPageProps> = ({ studentId, currentTopic }) => {
  // State
  const [status, setStatus] = useState('ready');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [readAlongContent, setReadAlongContent] = useState<ReadAlongContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('subject');
  const [textSize, setTextSize] = useState('text-xl');
  const [complexity, setComplexity] = useState(1);
  const [theme, setTheme] = useState('');
  const [showImage, setShowImage] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [suggestedThemes, setSuggestedThemes] = useState<string[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [currentStoryTheme, setCurrentStoryTheme] = useState<string>('');
  
  // WebSocket setup
  useEffect(() => {
    const statusChangeHandler = (newStatus: string) => setStatus(newStatus);
    const sessionStartedHandler = (newSessionId: string) => setSessionId(newSessionId);
    
    const readAlongHandler = (response: any) => {
      console.log('Received read-along data:', response);
      setIsGenerating(false);
      
      if (response.status === 'error') {
        console.error('Error generating read-along:', response.message);
        return;
      }
      
      // Just use the response directly as it comes from backend
      if (response.type === "read_along" && response.content) {
        const content = response.content;
        
        // Set the content
        setReadAlongContent(content);
        
        // Move to content view after generation
        setActiveTab('content');
      } else {
        console.error('Unexpected response format:', response);
      }
    };
    
    // Register all handlers
    const unregisterStatusChange = webSocketService.on('statusChange', statusChangeHandler);
    const unregisterSessionStarted = webSocketService.on('sessionStarted', sessionStartedHandler);
    const removeReadAlong = webSocketService.registerHandler('read_along', readAlongHandler);
    
    // Cleanup on unmount
    return () => {
      unregisterStatusChange();
      unregisterSessionStarted();
      removeReadAlong();
      
      if (webSocketService.getStatus() !== 'disconnected') {
        webSocketService.disconnect();
      }
    };
  }, []);

  // Subject and theme selection
  useEffect(() => {
    if (selectedSubject) {
      const subject = popularSubjects.find(s => s.id === selectedSubject);
      if (subject) {
        setSuggestedThemes(subject.themes);
        if (!theme && subject.themes.length > 0) {
          setTheme(subject.themes[0]);
        }
      }
    } else {
      setSuggestedThemes([]);
    }
  }, [selectedSubject, theme]);

  // WebSocket initialization
  const initializeSession = async () => {
    try {
      setStatus('connecting');
      
      await webSocketService.connect({
        subject: currentTopic?.subject || "reading",
        skill_description: currentTopic?.skill?.description || "Reading comprehension",
        subskill_description: currentTopic?.subskill?.description || "Interactive reading",
        student_id: studentId || 1000,
        competency_score: 7.0,
        skill_id: currentTopic?.skill?.id || "reading-skill-1",
        subskill_id: currentTopic?.subskill?.id || "interactive-reading-1",
        unit_id: "READ01"
      });
    } catch (error) {
      console.error('Failed to initialize session:', error);
      setStatus('error');
    }
  };

  // Generate read-along story
  const generateReadAlong = useCallback(async () => {
    // Ensure we have a connection
    if (status !== 'connected') {
      try {
        await initializeSession();
      } catch (error) {
        console.error('Failed to initialize session:', error);
        setStatus('error');
        return;
      }
    }
    
    setIsGenerating(true);
    
    // Get final theme from subject if needed
    let finalTheme = theme;
    if (selectedSubject && (!theme || theme.trim() === '')) {
      const subject = popularSubjects.find(s => s.id === selectedSubject);
      finalTheme = subject?.name || selectedSubject;
    }
    
    // Store current theme for potential reuse
    setCurrentStoryTheme(finalTheme);
    
    // Automatically move to content tab to show loading state
    setActiveTab('content');
    
    // Send request
    webSocketService.sendReadAlongRequest({
      complexity_level: complexity,
      theme: finalTheme || undefined,
      with_image: showImage
    });
  }, [status, complexity, theme, showImage, selectedSubject]);

  // Generate new story with same theme
  const generateNewStoryWithSameTheme = useCallback(() => {
    setReadAlongContent(null);
    setIsGenerating(true);
    
    // Send request with the same theme
    webSocketService.sendReadAlongRequest({
      complexity_level: complexity,
      theme: currentStoryTheme || undefined,
      with_image: showImage
    });
  }, [complexity, currentStoryTheme, showImage]);

  // Event handlers
  const handleSubjectSelect = useCallback((subjectId: string) => {
    setSelectedSubject(subjectId);
    setTheme('');
    
    // Initiate WebSocket connection when a subject is selected
    if (status === 'ready' || status === 'error') {
      initializeSession();
    }
    
    // Move to customize tab
    setActiveTab('customize');
  }, [status]);

  const handleSuggestedThemeSelect = useCallback((suggestedTheme: string) => {
    setTheme(suggestedTheme);
  }, []);

  const handleTryAgain = useCallback(() => {
    if (status === 'error') {
      setStatus('ready');
    }
  }, [status]);

  const readContentAloud = useCallback(() => {
    if (!readAlongContent || !readAlongContent.parts) return;
    
    // Collect all text content
    const allText = readAlongContent.parts
      .filter(part => part.text)
      .map(part => part.text)
      .join('. ');
      
    if (!allText) return;
    
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(allText);
    speech.rate = 0.8; // Slightly slower for children
    speech.pitch = 1.1; // Slightly higher pitch for children's content
    window.speechSynthesis.speak(speech);
  }, [readAlongContent]);

  const resetAndStartOver = useCallback(() => {
    window.speechSynthesis.cancel();
    setReadAlongContent(null);
    setActiveTab('subject');
  }, []);

  const increaseTextSize = useCallback(() => {
    const sizes = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
    const currentIndex = sizes.indexOf(textSize);
    if (currentIndex < sizes.length - 1) {
      setTextSize(sizes[currentIndex + 1]);
    }
  }, [textSize]);

  const decreaseTextSize = useCallback(() => {
    const sizes = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
    const currentIndex = sizes.indexOf(textSize);
    if (currentIndex > 0) {
      setTextSize(sizes[currentIndex - 1]);
    }
  }, [textSize]);

  // Render content
  const renderReadAlongContent = () => {
    if (!readAlongContent || !readAlongContent.parts) {
      return null;
    }
    
    return (
      <div className="space-y-6">
        {readAlongContent.parts.map((part, index) => (
          <div key={index}>
            {part.text && (
              <div className={`bg-slate-50 p-6 rounded-lg ${textSize} leading-relaxed`}>
                {part.text.replace(/\*\*/g, '')}
              </div>
            )}
            
            {part.image_base64 && (
              <div className="flex justify-center">
                <img 
                  src={`data:${part.mime_type || 'image/png'};base64,${part.image_base64}`}
                  alt="Story illustration" 
                  className="max-h-80 object-contain rounded-lg shadow-md"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Disabled state
  const controlsDisabled = isGenerating || status === 'connecting' || status === 'error';

  // Render content
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Error alert */}
      {status === 'error' && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            An error occurred connecting to the read-along service.
            <Button variant="outline" size="sm" onClick={handleTryAgain} className="ml-2">
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="hidden">
          <TabsTrigger value="subject">Subject</TabsTrigger>
          <TabsTrigger value="customize">Customize</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>
        
        {/* Subject selection */}
        <TabsContent value="subject" className="mt-0">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Choose a Subject</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {popularSubjects.map((subject) => (
                  <motion.div
                    key={subject.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant={selectedSubject === subject.id ? "default" : "outline"}
                      className="h-28 w-full flex flex-col items-center justify-center gap-2 p-2"
                      onClick={() => handleSubjectSelect(subject.id)}
                      disabled={controlsDisabled}
                    >
                      <span className="text-3xl">{subject.icon}</span>
                      <span className="text-sm font-semibold">{subject.name}</span>
                    </Button>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Customization */}
        <TabsContent value="customize" className="mt-0">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Customize Your Reading</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Reading level slider */}
              <div className="space-y-4">
                <Label className="text-lg">Reading Level</Label>
                <div className="space-y-2">
                  <Slider
                    min={1}
                    max={3}
                    step={1}
                    value={[complexity]}
                    onValueChange={(value) => setComplexity(value[0])}
                    disabled={controlsDisabled}
                  />
                  <div className="flex justify-between text-sm">
                    <span>Beginner</span>
                    <span>Developing</span>
                    <span>Advanced</span>
                  </div>
                </div>
              </div>
              
              {/* Themes */}
              {suggestedThemes.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-lg">Suggested Themes</Label>
                  <div className="flex flex-wrap gap-2">
                    {suggestedThemes.map((suggTheme) => (
                      <Button
                        key={suggTheme}
                        size="sm"
                        variant={theme === suggTheme ? "default" : "outline"}
                        onClick={() => handleSuggestedThemeSelect(suggTheme)}
                        disabled={controlsDisabled}
                      >
                        {suggTheme}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Advanced options */}
              <Button 
                variant="outline" 
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="w-full flex items-center justify-between"
              >
                <span className="flex items-center">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Advanced Options
                </span>
                <span className={`transition-transform duration-200 ${showAdvancedOptions ? 'rotate-90' : ''}`}>›</span>
              </Button>
              
              {showAdvancedOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-2"
                >
                  <div className="space-y-2">
                    <Label htmlFor="theme">Custom Theme</Label>
                    <Input
                      id="theme"
                      placeholder="Enter a specific theme..."
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      disabled={controlsDisabled}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="showImage"
                      checked={showImage}
                      onChange={() => setShowImage(!showImage)}
                      disabled={controlsDisabled}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="showImage">Include an image</Label>
                  </div>
                </motion.div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline"
                onClick={() => setActiveTab('subject')}
                disabled={controlsDisabled}
              >
                Back
              </Button>
              <Button 
                onClick={generateReadAlong}
                disabled={controlsDisabled || status !== 'connected'}
                className="px-8"
              >
                {status === 'connecting' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Story
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Content display */}
        <TabsContent value="content" className="mt-0">
          <Card className="mx-auto max-w-3xl">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl">
                  {readAlongContent?.title || "Read Along Story"}
                </CardTitle>
                
                {!isGenerating && readAlongContent && (
                  <div className="flex items-center space-x-2">
                    {/* Read aloud button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={readContentAloud}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Read Aloud
                    </Button>
                    
                    {/* New story button */}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={resetAndStartOver}
                    >
                      New Story
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Reading instructions */}
              {readAlongContent?.reading_instructions && (
                <div className="mt-2 text-sm p-2 bg-amber-50 border border-amber-200 rounded-md">
                  {readAlongContent.reading_instructions}
                </div>
              )}
            </CardHeader>
            
            <CardContent className="pt-4">
              {/* Loading state */}
              {isGenerating && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
                  <p className="text-lg">Creating your personalized story...</p>
                </div>
              )}
              
              {/* Empty state */}
              {!isGenerating && !readAlongContent && (
                <div className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-16 w-16 mb-4 text-muted-foreground" />
                  <p className="text-lg text-center mb-2">Pick a subject and create your read-along story</p>
                  <Button 
                    variant="default" 
                    onClick={() => setActiveTab('subject')}
                    className="mt-4"
                  >
                    Start Creating
                  </Button>
                </div>
              )}
              
              {/* Story content */}
              {!isGenerating && readAlongContent && (
                <div className="py-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    {renderReadAlongContent()}
                  </motion.div>
                  
                  {/* Text size controls and navigation controls at bottom */}
                  <div className="mt-6 flex flex-col space-y-4">
                    {/* Text size controls */}
                    <div className="flex justify-center items-center gap-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={decreaseTextSize}
                        title="Decrease text size"
                      >
                        <span className="text-lg">A-</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={increaseTextSize}
                        title="Increase text size"
                      >
                        <span className="text-lg">A+</span>
                      </Button>
                    </div>
                    
                    {/* Navigation controls */}
                    <div className="flex justify-between items-center pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab('customize')}
                      >
                        Back
                      </Button>
                      <Button
                        variant="default"
                        onClick={generateNewStoryWithSameTheme}
                      >
                        New Story
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReadAlongPage;