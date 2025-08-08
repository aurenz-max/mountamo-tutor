import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, BookOpen, Lightbulb, Loader2, Eye, Sparkles, MessageCircle, X, Maximize } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';

interface ReadingContentProps {
  content: {
    title: string;
    sections: Array<{
      heading: string;
      content: string;
    }>;
    word_count: number;
  };
  isCompleted: boolean;
  onComplete: () => void;
  onAskAI: (message: string) => void;
  subskillId?: string; // 🆕 For saving visualizations to Cosmos DB
}

interface DiscoveryThreads {
  [sectionIndex: number]: {
    threads: string[];
    loading: boolean;
    error?: string;
  };
}

interface VisualContent {
  [sectionIndex: number]: {
    htmlContent: string | null;
    loading: boolean;
    error?: string;
    isOpen: boolean;
  };
}

export function ReadingContent({ content, isCompleted, onComplete, onAskAI, subskillId }: ReadingContentProps) {
  const [discoveryThreads, setDiscoveryThreads] = useState<DiscoveryThreads>({});
  const [visualContent, setVisualContent] = useState<VisualContent>({});

  // Generate discovery threads for all sections on mount - with better deduplication
  React.useEffect(() => {
    let isMounted = true;
    
    const generateAllDiscoveryThreads = async () => {
      for (let i = 0; i < content.sections.length; i++) {
        if (!isMounted) break; // Abort if component unmounted
        
        const section = content.sections[i];
        const hasExistingThreads = discoveryThreads[i]?.threads?.length > 0;
        const isCurrentlyLoading = discoveryThreads[i]?.loading;
        
        if (!hasExistingThreads && !isCurrentlyLoading) {
          await fetchDiscoveryThreads(i, section.heading, section.content);
        }
      }
    };

    // Only generate if we have sections and no existing threads
    const hasAnyThreads = Object.values(discoveryThreads).some(d => d?.threads?.length > 0);
    if (content.sections.length > 0 && !hasAnyThreads) {
      generateAllDiscoveryThreads();
    }

    return () => {
      isMounted = false;
    };
  }, [content.sections]);

  const fetchDiscoveryThreads = async (sectionIndex: number, heading: string, sectionContent: string) => {
    // Prevent duplicate requests
    if (discoveryThreads[sectionIndex]?.loading || discoveryThreads[sectionIndex]?.threads?.length > 0) {
      return;
    }

    // Set loading state
    setDiscoveryThreads(prev => ({
      ...prev,
      [sectionIndex]: { 
        threads: prev[sectionIndex]?.threads || [], 
        loading: true 
      }
    }));

    try {
      // Make API call to generate discovery threads using authApi
      const data = await authApi.post('/api/discovery/section/discovery-threads', {
        heading: heading,
        content: sectionContent
      });
      
      // Update state with fetched threads
      setDiscoveryThreads(prev => ({
        ...prev,
        [sectionIndex]: {
          threads: data.discovery_threads || [],
          loading: false
        }
      }));

    } catch (error) {
      console.error('Error fetching discovery threads:', error);
      setDiscoveryThreads(prev => ({
        ...prev,
        [sectionIndex]: {
          threads: prev[sectionIndex]?.threads || [],
          loading: false,
          error: 'Failed to load discovery threads'
        }
      }));
    }
  };

  const handleThreadClick = async (sectionIndex: number, threadIndex: number, thread: string) => {
    // Send the question to AI
    onAskAI(thread);

    // Replace this specific thread with a new one
    const section = content.sections[sectionIndex];
    
    // Set loading state for this specific thread
    setDiscoveryThreads(prev => ({
      ...prev,
      [sectionIndex]: {
        ...prev[sectionIndex],
        loading: true
      }
    }));

    try {
      // Generate a new thread to replace the clicked one
      const data = await authApi.post('/api/discovery/section/discovery-threads', {
        heading: section.heading,
        content: section.content
      });

      if (data.discovery_threads && data.discovery_threads.length > 0) {
        // Replace the clicked thread with a new one
        setDiscoveryThreads(prev => {
          const currentThreads = [...(prev[sectionIndex]?.threads || [])];
          // Replace with a random new thread to avoid repetition
          const randomNewThread = data.discovery_threads[Math.floor(Math.random() * data.discovery_threads.length)];
          currentThreads[threadIndex] = randomNewThread;
          
          return {
            ...prev,
            [sectionIndex]: {
              threads: currentThreads,
              loading: false
            }
          };
        });
      }
    } catch (error) {
      console.error('Error replacing discovery thread:', error);
      // Just remove loading state, keep existing threads
      setDiscoveryThreads(prev => ({
        ...prev,
        [sectionIndex]: {
          ...prev[sectionIndex],
          loading: false
        }
      }));
    }
  };

  const handleVisualizeClick = async (sectionIndex: number, heading: string, sectionContent: string) => {
    // Prevent duplicate requests - if already loading or has content, don't request again
    if (visualContent[sectionIndex]?.loading || visualContent[sectionIndex]?.htmlContent) {
      setVisualContent(prev => ({
        ...prev,
        [sectionIndex]: {
          ...prev[sectionIndex],
          isOpen: true
        }
      }));
      return;
    }

    // Set loading state and open modal
    setVisualContent(prev => ({
      ...prev,
      [sectionIndex]: {
        ...prev[sectionIndex],
        loading: true,
        error: undefined,
        isOpen: true,
        htmlContent: null
      }
    }));

    try {
      // Phase 2: Try AI generation first
      try {
        const data = await authApi.post('/api/discovery/section/generate-visual', {
          heading: heading,
          content: sectionContent,
          subskill_id: subskillId // 🆕 Auto-save to Cosmos DB if provided
        });
        
        setVisualContent(prev => ({
          ...prev,
          [sectionIndex]: {
            ...prev[sectionIndex],
            loading: false,
            htmlContent: data.html_content,
            walkthroughThreads: [],
            walkthroughLoading: false,
            showWalkthrough: false
          }
        }));
        
        // Auto-generate walkthrough threads after visual is ready
        generateWalkthroughThreads(sectionIndex, heading, sectionContent);
        return; // Success, exit early
      } catch (aiError) {
        console.warn('AI generation failed, falling back to pre-built demo:', aiError);
        
        // Phase 1 Fallback: Check if this is a section we have pre-built demos for
        const demoContent = getPrebuiltDemo(heading, sectionContent);
        
        if (demoContent) {
          // Use pre-built demo as fallback
          setVisualContent(prev => ({
            ...prev,
            [sectionIndex]: {
              ...prev[sectionIndex],
              loading: false,
              htmlContent: demoContent,
              walkthroughThreads: [],
              walkthroughLoading: false,
              showWalkthrough: false
            }
          }));
          
          // Auto-generate walkthrough threads for fallback demo too
          generateWalkthroughThreads(sectionIndex, heading, sectionContent);
          return; // Success with fallback
        }
        
        // If no pre-built demo available, throw error to be caught by outer catch
        throw new Error('No visual content available for this section');
      }
    } catch (error) {
      console.error('Error generating visual:', error);
      setVisualContent(prev => ({
        ...prev,
        [sectionIndex]: {
          ...prev[sectionIndex],
          loading: false,
          error: 'Failed to generate visual demonstration'
        }
      }));
    }
  };

  const closeVisualModal = (sectionIndex: number) => {
    setVisualContent(prev => ({
      ...prev,
      [sectionIndex]: {
        ...prev[sectionIndex],
        isOpen: false,
        showWalkthrough: false
      }
    }));
  };

  const generateWalkthroughThreads = async (sectionIndex: number, heading: string, sectionContent: string) => {
    setVisualContent(prev => ({
      ...prev,
      [sectionIndex]: {
        ...prev[sectionIndex],
        walkthroughLoading: true
      }
    }));

    try {
      const data = await authApi.post('/api/discovery/section/walkthrough-threads', {
        heading: heading,
        content: sectionContent,
        visual_type: 'interactive_demonstration'
      });

      setVisualContent(prev => ({
        ...prev,
        [sectionIndex]: {
          ...prev[sectionIndex],
          walkthroughThreads: data.walkthrough_threads || [
            "Walk me through this visual step by step",
            "Explain what I'm seeing in this demonstration",
            "How does this visual help me understand the concept?",
            "What should I focus on in this interactive demo?"
          ],
          walkthroughLoading: false
        }
      }));
    } catch (error) {
      console.error('Error generating walkthrough threads:', error);
      // Fallback to default threads if API fails
      setVisualContent(prev => ({
        ...prev,
        [sectionIndex]: {
          ...prev[sectionIndex],
          walkthroughThreads: [
            "Walk me through this visual step by step",
            "Explain what I'm seeing in this demonstration", 
            "How does this visual help me understand the concept?",
            "What should I focus on in this interactive demo?"
          ],
          walkthroughLoading: false
        }
      }));
    }
  };

  const handleWalkthroughThreadClick = async (sectionIndex: number, threadIndex: number, thread: string) => {
    // Send the question to AI
    onAskAI(thread);

    // Generate a new walkthrough thread to replace the clicked one
    const section = content.sections[sectionIndex];
    
    setVisualContent(prev => ({
      ...prev,
      [sectionIndex]: {
        ...prev[sectionIndex],
        walkthroughLoading: true
      }
    }));

    try {
      const data = await authApi.post('/api/discovery/section/walkthrough-threads', {
        heading: section.heading,
        content: section.content,
        visual_type: 'interactive_demonstration'
      });

      if (data.walkthrough_threads && data.walkthrough_threads.length > 0) {
        setVisualContent(prev => {
          const currentThreads = [...(prev[sectionIndex]?.walkthroughThreads || [])];
          const randomNewThread = data.walkthrough_threads[Math.floor(Math.random() * data.walkthrough_threads.length)];
          currentThreads[threadIndex] = randomNewThread;
          
          return {
            ...prev,
            [sectionIndex]: {
              ...prev[sectionIndex],
              walkthroughThreads: currentThreads,
              walkthroughLoading: false
            }
          };
        });
      }
    } catch (error) {
      console.error('Error replacing walkthrough thread:', error);
      setVisualContent(prev => ({
        ...prev,
        [sectionIndex]: {
          ...prev[sectionIndex],
          walkthroughLoading: false
        }
      }));
    }
  };

  const toggleWalkthrough = (sectionIndex: number) => {
    setVisualContent(prev => ({
      ...prev,
      [sectionIndex]: {
        ...prev[sectionIndex],
        showWalkthrough: !prev[sectionIndex]?.showWalkthrough
      }
    }));
  };

  const getPrebuiltDemo = (heading: string, content: string): string | null => {
    // Phase 1 MVP: Pre-built demos for key concepts
    const headingLower = heading.toLowerCase();
    
    if (headingLower.includes('addition') || headingLower.includes('adding')) {
      return `
<!DOCTYPE html>
<html>
<head>
  <title>Addition Demo</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #f0f8ff; }
    .demo-container { max-width: 600px; margin: 0 auto; text-align: center; }
    .apple-group { display: inline-block; margin: 20px; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .apple { font-size: 40px; display: inline-block; margin: 5px; cursor: pointer; transition: transform 0.2s; }
    .apple:hover { transform: scale(1.2); }
    .plus { font-size: 60px; color: #4CAF50; margin: 0 20px; vertical-align: middle; }
    .equals { font-size: 60px; color: #2196F3; margin: 0 20px; vertical-align: middle; }
    .result { font-size: 80px; color: #FF5722; margin: 20px; }
    .controls { margin: 30px 0; }
    button { padding: 12px 24px; margin: 10px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; background: #4CAF50; color: white; }
    button:hover { background: #45a049; }
    .instruction { font-size: 18px; margin: 20px 0; color: #333; }
  </style>
</head>
<body>
  <div class="demo-container">
    <h2>Interactive Addition Demo</h2>
    <p class="instruction">Click the buttons to see different addition problems!</p>
    
    <div id="problem">
      <div class="apple-group">
        <div id="group1"></div>
        <div>Group 1</div>
      </div>
      <span class="plus">+</span>
      <div class="apple-group">
        <div id="group2"></div>
        <div>Group 2</div>
      </div>
      <span class="equals">=</span>
      <div class="apple-group">
        <div id="result"></div>
        <div>Total</div>
      </div>
    </div>
    
    <div class="controls">
      <button onclick="showProblem(2, 3)">2 + 3</button>
      <button onclick="showProblem(4, 1)">4 + 1</button>
      <button onclick="showProblem(3, 4)">3 + 4</button>
      <button onclick="showProblem(1, 5)">1 + 5</button>
    </div>
  </div>

  <script>
    function showProblem(a, b) {
      const group1 = document.getElementById('group1');
      const group2 = document.getElementById('group2');
      const result = document.getElementById('result');
      
      // Clear previous content
      group1.innerHTML = '';
      group2.innerHTML = '';
      result.innerHTML = '';
      
      // Add apples to first group
      for (let i = 0; i < a; i++) {
        group1.innerHTML += '<span class="apple">🍎</span>';
      }
      
      // Add apples to second group
      for (let i = 0; i < b; i++) {
        group2.innerHTML += '<span class="apple">🍎</span>';
      }
      
      // Show result after a brief delay
      setTimeout(() => {
        for (let i = 0; i < (a + b); i++) {
          result.innerHTML += '<span class="apple">🍎</span>';
        }
      }, 500);
    }
    
    // Start with 2 + 3
    showProblem(2, 3);
  </script>
</body>
</html>`;
    }
    
    if (headingLower.includes('number') || headingLower.includes('counting')) {
      return `
<!DOCTYPE html>
<html>
<head>
  <title>Numbers Demo</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .demo-container { max-width: 800px; margin: 0 auto; text-align: center; }
    .number-display { font-size: 120px; color: #fff; margin: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
    .objects-container { margin: 30px 0; }
    .object { font-size: 50px; display: inline-block; margin: 10px; animation: bounce 0.6s ease-in-out; }
    @keyframes bounce { 0%, 20%, 60%, 100% { transform: translateY(0); } 40% { transform: translateY(-30px); } 80% { transform: translateY(-15px); } }
    .controls { margin: 30px 0; }
    button { padding: 15px 30px; margin: 10px; font-size: 18px; border: none; border-radius: 10px; cursor: pointer; background: rgba(255,255,255,0.2); color: white; backdrop-filter: blur(10px); }
    button:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .instruction { font-size: 20px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="demo-container">
    <h2>Interactive Number Counting</h2>
    <p class="instruction">Click the buttons to see different numbers come to life!</p>
    
    <div class="number-display" id="numberDisplay">3</div>
    <div class="objects-container" id="objectsContainer"></div>
    
    <div class="controls">
      <button onclick="showNumber(1, '⭐')">1 Star</button>
      <button onclick="showNumber(3, '🎈')">3 Balloons</button>
      <button onclick="showNumber(5, '🌟')">5 Stars</button>
      <button onclick="showNumber(7, '🎪')">7 Tents</button>
      <button onclick="showNumber(2, '🦋')">2 Butterflies</button>
    </div>
  </div>

  <script>
    function showNumber(num, emoji) {
      const display = document.getElementById('numberDisplay');
      const container = document.getElementById('objectsContainer');
      
      display.textContent = num;
      container.innerHTML = '';
      
      // Add objects one by one with animation
      for (let i = 0; i < num; i++) {
        setTimeout(() => {
          const obj = document.createElement('span');
          obj.className = 'object';
          obj.textContent = emoji;
          container.appendChild(obj);
        }, i * 200);
      }
    }
    
    // Start with 3 balloons
    showNumber(3, '🎈');
  </script>
</body>
</html>`;
    }
    
    // Return null for sections without pre-built demos
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <div>
              <CardTitle className="text-2xl">{content.title}</CardTitle>
              <p className="text-muted-foreground">
                {content.word_count} words • {content.sections.length} sections
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {content.sections.map((section, index) => (
            <div key={index} className="border-b border-gray-100 pb-6 last:border-b-0">
              <h3 className="text-xl font-semibold mb-3 text-gray-900">{section.heading}</h3>
              <div className="prose prose-lg max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              </div>
              {/* Main Action Buttons */}
              <div className="mt-4 flex gap-3 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="mb-3"
                  onClick={() => onAskAI(`Tell me more about "${section.heading}"`)}
                >
                  Ask AI about this section
                </Button>
                
                <Dialog 
                  open={visualContent[index]?.isOpen || false}
                  onOpenChange={(open) => {
                    if (!open) closeVisualModal(index);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mb-3 border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300"
                      onClick={() => handleVisualizeClick(index, section.heading, section.content)}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      ✨ Visualize Concept
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Interactive Demo: {section.heading}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                      {visualContent[index]?.loading && (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 mb-4 animate-spin text-purple-600" />
                          <p className="text-sm text-muted-foreground">Generating interactive demonstration...</p>
                        </div>
                      )}
                      
                      {visualContent[index]?.error && (
                        <div className="text-center py-12">
                          <div className="text-red-600 mb-4">{visualContent[index]?.error}</div>
                          <Button 
                            variant="outline" 
                            onClick={() => handleVisualizeClick(index, section.heading, section.content)}
                          >
                            Try Again
                          </Button>
                        </div>
                      )}
                      
                      {visualContent[index]?.htmlContent && (
                        <div className="space-y-4">
                          <iframe
                            srcDoc={visualContent[index]?.htmlContent || ''}
                            sandbox="allow-scripts"
                            className="w-full h-[500px] border border-gray-200 rounded-lg"
                            title={`Interactive Demo for ${section.heading}`}
                          />
                          
                          {/* AI Walkthrough Threads */}
                          <div className="border-t pt-4">
                            <h4 className="text-sm font-medium text-gray-700 flex items-center mb-3">
                              <MessageCircle className="w-4 h-4 mr-2" />
                              Ask AI to walk you through this visual:
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Button
                                variant="ghost"
                                className="justify-start text-left h-auto py-3 px-3 border border-purple-100 hover:border-purple-200 hover:bg-purple-50 transition-colors"
                                onClick={() => onAskAI(`Walk me through this visual demonstration of "${section.heading}" step by step`)}
                              >
                                <span className="whitespace-normal text-sm">Walk me through this step by step</span>
                              </Button>
                              
                              <Button
                                variant="ghost"
                                className="justify-start text-left h-auto py-3 px-3 border border-purple-100 hover:border-purple-200 hover:bg-purple-50 transition-colors"
                                onClick={() => onAskAI(`Explain what I should focus on in this visual demonstration of "${section.heading}"`)}
                              >
                                <span className="whitespace-normal text-sm">What should I focus on here?</span>
                              </Button>
                              
                              <Button
                                variant="ghost"
                                className="justify-start text-left h-auto py-3 px-3 border border-purple-100 hover:border-purple-200 hover:bg-purple-50 transition-colors"
                                onClick={() => onAskAI(`How does this visual help me understand the concept of "${section.heading}"?`)}
                              >
                                <span className="whitespace-normal text-sm">How does this help me understand?</span>
                              </Button>
                              
                              <Button
                                variant="ghost"
                                className="justify-start text-left h-auto py-3 px-3 border border-purple-100 hover:border-purple-200 hover:bg-purple-50 transition-colors"
                                onClick={() => onAskAI(`Can you guide me through interacting with this visual demonstration of "${section.heading}"?`)}
                              >
                                <span className="whitespace-normal text-sm">Guide me through the interaction</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Discovery Threads Section */}
              <div className="space-y-3">
                {discoveryThreads[index]?.loading && !discoveryThreads[index]?.threads.length ? (
                  <div className="flex items-center py-2">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span className="text-sm text-muted-foreground">Generating discovery questions...</span>
                  </div>
                ) : discoveryThreads[index]?.threads.length > 0 ? (
                  <>
                    <h4 className="text-sm font-medium text-gray-700 flex items-center">
                      <Lightbulb className="w-4 h-4 mr-2" />
                      Discover More:
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {discoveryThreads[index].threads.map((thread, threadIndex) => (
                        <Button
                          key={`${index}-${threadIndex}-${thread.substring(0, 20)}`}
                          variant="ghost"
                          className="justify-start text-left h-auto py-3 px-3 border border-blue-100 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                          onClick={() => handleThreadClick(index, threadIndex, thread)}
                          disabled={discoveryThreads[index]?.loading}
                        >
                          {discoveryThreads[index]?.loading ? (
                            <div className="flex items-center">
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              <span className="whitespace-normal text-sm opacity-50">{thread}</span>
                            </div>
                          ) : (
                            <span className="whitespace-normal text-sm">{thread}</span>
                          )}
                        </Button>
                      ))}
                    </div>
                    {discoveryThreads[index]?.loading && (
                      <p className="text-xs text-gray-500 italic">Click a question to ask the AI tutor and get a new question...</p>
                    )}
                  </>
                ) : discoveryThreads[index]?.error ? (
                  <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-600">{discoveryThreads[index]?.error}</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fetchDiscoveryThreads(index, section.heading, section.content)}
                    >
                      Try Again
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          
          <div className="pt-6 border-t">
            <Button 
              onClick={onComplete}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isCompleted}
            >
              {isCompleted ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Completed
                </>
              ) : (
                'Mark as Complete'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}