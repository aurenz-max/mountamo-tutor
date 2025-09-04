import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, BookOpen, Lightbulb, Loader2, Eye, Sparkles, MessageCircle, X, Maximize } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';
import { ReadingContentRenderer } from '@/components/content/ReadingContentRenderer';

// Updated interface to support interactive primitives - Enhanced with new primitives
interface ReadingSection {
  heading: string;
  content: string;
  key_terms_used: string[];
  concepts_covered: string[];
  // Basic Interactive primitives (optional)
  alerts?: Array<{ type: 'alert'; style: 'info' | 'warning' | 'success' | 'tip'; title: string; content: string; }>;
  expandables?: Array<{ type: 'expandable'; title: string; content: string; }>;
  quizzes?: Array<{ type: 'quiz'; question: string; answer: string; explanation?: string; }>;
  definitions?: Array<{ type: 'definition'; term: string; definition: string; }>;
  checklists?: Array<{ type: 'checklist'; text: string; completed?: boolean; }>;
  tables?: Array<{ type: 'table'; headers: string[]; rows: string[][]; }>;
  keyvalues?: Array<{ type: 'keyvalue'; key: string; value: string; }>;
  // New Enhanced Interactive Primitives
  interactive_timelines?: Array<{ type: 'interactive_timeline'; title: string; events: Array<{date: string; title: string; description: string;}> }>;
  carousels?: Array<{ type: 'carousel'; title?: string; items: Array<{image_url: string; alt_text: string; caption?: string; description?: string;}> }>;
  flip_cards?: Array<{ type: 'flip_card'; front_content: string; back_content: string; }>;
  categorization_activities?: Array<{ type: 'categorization'; instruction: string; categories: string[]; items: Array<{item_text: string; correct_category: string;}> }>;
  fill_in_the_blanks?: Array<{ type: 'fill_in_the_blank'; sentence: string; correct_answer: string; hint?: string; }>;
  scenario_questions?: Array<{ type: 'scenario_question'; scenario: string; question: string; answer_options?: string[]; correct_answer: string; explanation: string; }>;
}

interface ReadingContentProps {
  content: {
    title: string;
    sections: ReadingSection[];
    word_count: number;
    reading_level?: string;
    grade_appropriate_features?: string[];
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

  // Prepare content for ReadingContentRenderer with fallbacks
  const rendererContent = {
    title: content.title,
    sections: content.sections,
    word_count: content.word_count,
    reading_level: content.reading_level || 'Not specified',
    grade_appropriate_features: content.grade_appropriate_features || []
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 bg-gray-50 min-h-screen p-6">
      {/* Enhanced Content Renderer with Inline AI Features */}
      <ReadingContentRenderer 
        content={rendererContent} 
        onAskAI={onAskAI}
        discoveryThreads={discoveryThreads}
        visualContent={visualContent}
        onDiscoveryThreadClick={handleThreadClick}
        onVisualizeClick={handleVisualizeClick}
        onCloseVisualModal={closeVisualModal}
        subskillId={subskillId}
      />
      
      {/* Completion Section */}
      <Card className="border-2 border-blue-100 bg-blue-50/30">
        <CardContent className="pt-6">
          <Button 
            onClick={onComplete}
            className="bg-blue-600 hover:bg-blue-700 text-white w-full"
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
        </CardContent>
      </Card>
    </div>
  );
}