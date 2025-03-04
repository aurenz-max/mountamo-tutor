import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { visualContentApi, ImageInfo } from '@/lib/visualContentApi';
import DrawingWorkspace from './DrawingWorkspace';
import ImageBrowser from './ImageBrowser';
import DraggableImage from './DraggableImage';
import VisualSceneManager from './VisualSceneManager';
import ProblemDisplay from './ProblemDisplay'; // Import the new ProblemDisplay component
import './InteractiveWorkspace.css';

// Define the interface for workspace images
interface WorkspaceImage {
  id: string;
  image: ImageInfo;
  position: { x: number; y: number };
}

interface InteractiveWorkspaceProps {
  currentTopic: any;
  studentId: number;
  onSubmit: (canvasData: string) => void;
  sessionId?: string | null;
  currentProblem?: any; // Keep this optional with ?
  currentScene?: any; // Make sure it's optional with ?
}


const InteractiveWorkspace = forwardRef(({ 
  currentTopic, 
  studentId, 
  onSubmit, 
  sessionId = null,
  currentProblem: externalProblem = null,
  currentScene: externalScene = null 
}, ref) => {
  // Problem state
  const [currentProblem, setCurrentProblem] = useState<any>(externalProblem);
  const [isProblemOpen, setIsProblemOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<any>(null);
  
  // Visual tools state
  const [isVisualToolsOpen, setIsVisualToolsOpen] = useState(false);
  const [workspaceImages, setWorkspaceImages] = useState<WorkspaceImage[]>([]);
  
  const drawingRef = useRef<any>();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    setProblemOpen: (isOpen: boolean) => {
      setIsProblemOpen(isOpen);
    }
  }));

  // Update currentProblem when externalProblem changes
  useEffect(() => {
    if (externalProblem) {
      setCurrentProblem(externalProblem);
      setIsProblemOpen(true); // Automatically open problem panel when a problem is received
    }
  }, [externalProblem]);

  useEffect(() => {
    if (externalScene) {
      console.log('InteractiveWorkspace received scene:', externalScene);
    }
  }, [externalScene]);

  // Generate a session ID if not provided
  useEffect(() => {
    if (!sessionId) {
      sessionId = `session_${Date.now()}`;
    }
  }, [sessionId]);

  // Function to capture and render images onto the canvas for submission
  const captureImagesForCanvas = (combinedCanvas, combinedCtx) => {
    // If no images, return immediately
    if (workspaceImages.length === 0) return Promise.resolve();
    
    console.log(`Adding ${workspaceImages.length} images to canvas...`);
    
    // Create promises for each image load
    const imagePromises = workspaceImages.map(item => {
      return new Promise((resolve) => {
        if (!item.image.data_uri) {
          resolve(null);
          return;
        }
        
        const img = new Image();
        
        img.onload = () => {
          const dpr = window.devicePixelRatio || 1;
          
          // Position with device pixel ratio adjustment
          const x = item.position.x * dpr;
          const y = item.position.y * dpr;
          
          // Calculate dimensions
          let width, height;
          
          if (item.image._previewSize) {
            width = item.image._previewSize.width * dpr;
            height = item.image._previewSize.height * dpr;
          } else if (item.image.type === 'svg') {
            width = 60 * dpr;
            height = 60 * dpr;
          } else {
            const maxSize = 80 * dpr;
            const ratio = Math.min(maxSize / img.width, maxSize / img.height);
            width = img.width * ratio;
            height = img.height * ratio;
          }
          
          // Draw to combined canvas
          combinedCtx.drawImage(img, x, y, width, height);
          resolve(true);
        };
        
        img.onerror = () => {
          console.error(`Failed to load image: ${item.id}`);
          resolve(null);
        };
        
        img.src = item.image.data_uri;
      });
    });
    
    // Return a promise that resolves when all images are drawn
    return Promise.all(imagePromises);
  };

  // Toggle fullscreen function
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      // If not in fullscreen mode, enter fullscreen
      if (workspaceRef.current.requestFullscreen) {
        workspaceRef.current.requestFullscreen();
        setIsFullScreen(true);
      } else if (workspaceRef.current.webkitRequestFullscreen) { /* Safari */
        workspaceRef.current.webkitRequestFullscreen();
        setIsFullScreen(true);
      } else if (workspaceRef.current.msRequestFullscreen) { /* IE11 */
        workspaceRef.current.msRequestFullscreen();
        setIsFullScreen(true);
      }
    } else {
      // If already in fullscreen mode, exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      } else if (document.webkitExitFullscreen) { /* Safari */
        document.webkitExitFullscreen();
        setIsFullScreen(false);
      } else if (document.msExitFullscreen) { /* IE11 */
        document.msExitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  // Toggle theater mode function
  const toggleTheaterMode = () => {
    const newMode = !isTheaterMode;
    setIsTheaterMode(newMode);
    
    // Add a longer delay to ensure all DOM updates have happened
    setTimeout(() => {
      if (drawingRef.current && drawingRef.current.forceCanvasResize) {
        console.log("Forcing canvas resize after theater mode toggle");
        drawingRef.current.forceCanvasResize();
      }
    }, 300); // Increased delay to ensure DOM updates complete
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  
  // Add a handler for when the VisualSceneManager creates images
  const handleSceneImagesCreated = (newImages: WorkspaceImage[]) => {
    console.log('Scene manager created images:', newImages);
    
    // Add the new images to the workspace
    setWorkspaceImages(prev => [...prev, ...newImages]);
  };

  const generateNewProblem = async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    if (drawingRef.current) drawingRef.current.clearCanvas();
    try {
      const problemRequest = {
        subject: currentTopic.subject,
        unit: currentTopic.unit,
        skill: currentTopic.skill,
        subskill: currentTopic.subskill,
        difficulty: currentTopic.difficulty_range?.target || 1.0,
      };
      const response = await api.generateProblem(problemRequest);
      setCurrentProblem(response);
    } catch (error) {
      console.error('Error generating problem:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!drawingRef.current) return;
    setSubmitting(true);
    setError(null);
    
    try {
      // Use the async getCanvasData method which will handle drawing + images
      const canvasData = await drawingRef.current.getCanvasData();
      
      console.log(`Submitting canvas data of length: ${canvasData?.length || 0}`);
      
      // Create the submission with the combined data
      const submission = {
        subject: currentTopic.subject,
        problem: currentProblem,
        solution_image: canvasData,
        skill_id: currentTopic.skill?.id || '',
        subskill_id: currentTopic.subskill?.id || '',
        student_answer: '',
        canvas_used: true,
        student_id: studentId,
      };
      
      const response = await api.submitProblem(submission);
      setFeedback(response);
      if (onSubmit) onSubmit(canvasData);
    } catch (error) {
      console.error('Error submitting problem:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle dropping images onto the workspace
  const handleWorkspaceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      // Get image data from the drag event
      const imageData = JSON.parse(e.dataTransfer.getData('application/json')) as ImageInfo;
      if (!imageData) return;
      
      // Fetch full image data if needed and add to workspace
      fetchImageContent(imageData).then(fullImageData => {
        // Calculate drop position relative to workspace
        if (workspaceRef.current) {
          const workspaceRect = workspaceRef.current.getBoundingClientRect();
          const dropX = e.clientX - workspaceRect.left;
          const dropY = e.clientY - workspaceRect.top;
          
          // Add the image to workspace state
          addImageToWorkspace(fullImageData, { x: dropX, y: dropY });
        }
      });
    } catch (err) {
      console.error('Error handling dropped image:', err);
    }
  };

  // Fetch full image content if not already available
  const fetchImageContent = async (imageData: ImageInfo): Promise<ImageInfo> => {
    // If image already has data_uri, return it as is
    if (imageData.data_uri) return imageData;
    
    try {
      // Otherwise fetch the full image data
      const response = await visualContentApi.getVisualImage(imageData.id);
      if (response.status === 'success' && response.image) {
        return response.image;
      }
      return imageData; // Return original if fetch fails
    } catch (err) {
      console.error('Error fetching image content:', err);
      return imageData;
    }
  };

  // Create a unique ID for each image instance
  const generateImageId = (): string => {
    return `img_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  };

  // Add an image to the workspace
  const addImageToWorkspace = (imageData: ImageInfo, position?: { x: number; y: number }) => {
    const newImage: WorkspaceImage = {
      id: generateImageId(),
      image: imageData,
      position: position || { x: 50, y: 50 } // Default position if none provided
    };
    
    setWorkspaceImages(prev => [...prev, newImage]);
  };

  // Handle image selection from the browser
  const handleImageSelected = async (imageData: ImageInfo) => {
    // Fetch full image data if needed
    const fullImageData = await fetchImageContent(imageData);
    
    // Place the image in the center of the workspace
    if (workspaceRef.current) {
      const rect = workspaceRef.current.getBoundingClientRect();
      const centerX = rect.width / 2 - 40; // Offset by half of typical image width
      const centerY = rect.height / 2 - 40; // Offset by half of typical image height
      
      addImageToWorkspace(fullImageData, { x: centerX, y: centerY });
    } else {
      addImageToWorkspace(fullImageData);
    }
  };

  // Update image position
  const updateImagePosition = (id: string, newPosition: { x: number; y: number }) => {
    setWorkspaceImages(prev => 
      prev.map(img => 
        img.id === id ? { ...img, position: newPosition } : img
      )
    );
  };

  // Remove an image from the workspace
  const removeImage = (id: string) => {
    setWorkspaceImages(prev => prev.filter(img => img.id !== id));
  };

  // Clear all images from the workspace
  const clearAllImages = () => {
    setWorkspaceImages([]);
  };

  // Toggle image browser
  const toggleImageBrowser = () => {
    setIsVisualToolsOpen(!isVisualToolsOpen);
  };

  return (
    <div className={`relative flex flex-col h-full ${isTheaterMode ? 'theater-mode' : ''}`}>
      {/* VisualSceneManager component */}
      <VisualSceneManager
        scene={externalScene}
        workspaceRef={workspaceRef}
        onImagesCreated={handleSceneImagesCreated}
      />
      
      {/* Top Bar - always visible even in theater mode */}
      <div className="bg-gray-100 p-2 flex justify-end items-center">
        <Button
          onClick={() => setIsProblemOpen(!isProblemOpen)}
          className="ml-auto"
          variant="secondary"
          size="sm"
        >
          {isProblemOpen ? '← Hide Problem' : 'Show Problem'}
        </Button>
      </div>
  
      {/* Main Content */}
      <div className="flex flex-1 relative">
        {/* Drawing Area with Draggable Images */}
        <div 
          ref={workspaceRef}
          className={`transition-all duration-300 relative drawing-workspace ${isProblemOpen && !isTheaterMode ? 'w-2/3' : 'w-full'}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleWorkspaceDrop}
        >
          <div className="h-full">
            <DrawingWorkspace 
              ref={drawingRef} 
              loading={loading} 
              captureImagesCallback={captureImagesForCanvas}
              isTheaterMode={isTheaterMode}
            />
            
            {/* Draggable images layer */}
            <div className="draggable-images-container">
              {workspaceImages.map((item) => (
                <DraggableImage
                  key={item.id}
                  image={item.image}
                  position={item.position}
                  onPositionChange={(newPos) => updateImagePosition(item.id, newPos)}
                  onRemove={() => removeImage(item.id)}
                />
              ))}
            </div>
            
            {/* Image toolbar - only show when images exist */}
            {workspaceImages.length > 0 && (
              <button 
                className="clear-images-button"
                onClick={clearAllImages}
              >
                Clear All Images
              </button>
            )}
            
            {/* Small toggle button for image browser */}
            <button
              className="toggle-image-browser"
              onClick={toggleImageBrowser}
              aria-label={isVisualToolsOpen ? "Hide image library" : "Show image library"}
            >
              {isVisualToolsOpen ? "×" : "+"}
            </button>
            
            {/* Theater mode toggle button */}
            <button
              className="theater-mode-button"
              onClick={toggleTheaterMode}
              aria-label={isTheaterMode ? "Exit theater mode" : "Enter theater mode"}
            >
              {isTheaterMode ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
        
        {/* Image Browser Panel - Handle positioning for theater mode */}
        {isVisualToolsOpen && (
          <div className={`image-browser-sidebar ${isProblemOpen ? 'with-problem-panel' : ''}`}>
            <ImageBrowser onImageSelected={handleImageSelected} />
          </div>
        )}
  
        {/* Problem Panel - Now using the ProblemDisplay component */}
        {isProblemOpen && (
          <div className={isTheaterMode ? "theater-mode-problem-panel" : "w-1/3 bg-white border-l"}>
            <ProblemDisplay
              problem={currentProblem}
              loading={loading}
              error={error}
              feedback={feedback}
              submitting={submitting}
              isTheaterMode={isTheaterMode}
              onGenerateProblem={generateNewProblem}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default InteractiveWorkspace;