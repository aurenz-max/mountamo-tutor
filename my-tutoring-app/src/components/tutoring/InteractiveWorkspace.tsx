import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { visualContentApi, ImageInfo } from '@/lib/visualContentApi';
import DrawingWorkspace from './DrawingWorkspace';
import ImageBrowser from './ImageBrowser';
import DraggableImage from './DraggableImage';
import VisualSceneManager from './VisualSceneManager';
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
    // Only proceed if we have images to capture
    if (workspaceImages.length === 0) return;
    
    // Get the canvas scale factor (device pixel ratio)
    const dpr = window.devicePixelRatio || 1;
    
    // Create an array to track when all images are loaded
    const imageLoadPromises = workspaceImages.map(item => {
      return new Promise((resolve) => {
        // Skip if no data_uri
        if (!item.image.data_uri) {
          resolve(null);
          return;
        }
        
        // Create an Image object for the draggable image
        const img = new Image();
        
        // Set up the onload handler before setting the src
        img.onload = () => {
          // Calculate the position with device pixel ratio adjustment
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
            // Use image's natural dimensions with scaling
            const maxSize = 80 * dpr;
            const ratio = Math.min(maxSize / img.width, maxSize / img.height);
            width = img.width * ratio;
            height = img.height * ratio;
          }
          
          // Draw the image on the canvas
          combinedCtx.drawImage(img, x, y, width, height);
          resolve(true);
        };
        
        // Handle load errors
        img.onerror = () => {
          console.error(`Failed to load image: ${item.id}`);
          resolve(null);
        };
        
        // Set the source to the image's data URI
        img.src = item.image.data_uri;
      });
    });
    
    // Return a promise that resolves when all images are drawn
    return Promise.all(imageLoadPromises);
  };

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
      // Get the canvas data first (this uses the existing getCanvasData method)
      const canvasData = drawingRef.current.getCanvasData();
      
      // Create a temporary canvas to draw both the original drawing and the images
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      // Find the size of the original canvas by finding its container
      const workspaceElement = workspaceRef.current;
      if (!workspaceElement) {
        throw new Error('Workspace reference is not available');
      }
      
      // Get the canvas container dimensions
      const canvasContainer = workspaceElement.querySelector('.w-full.h-96');
      if (!canvasContainer) {
        throw new Error('Cannot find canvas container');
      }
      
      const rect = canvasContainer.getBoundingClientRect();
      
      // Set up the temporary canvas with the right dimensions
      const dpr = window.devicePixelRatio || 1;
      tempCanvas.width = rect.width * dpr;
      tempCanvas.height = rect.height * dpr;
      
      // Draw the original canvas content
      const img = new Image();
      img.onload = () => {
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
      };
      img.src = 'data:image/png;base64,' + canvasData;
      
      // Wait for the original canvas to load
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Now stamp all images onto this canvas
      const imagePromises = workspaceImages.map(item => {
        return new Promise((resolve) => {
          if (!item.image.data_uri) {
            resolve(null);
            return;
          }
          
          const imgEl = new Image();
          imgEl.onload = () => {
            // Calculate size similar to DraggableImage component
            let width, height;
            
            if (item.image._previewSize) {
              width = item.image._previewSize.width;
              height = item.image._previewSize.height;
            } else if (item.image.type === 'svg') {
              width = 60;
              height = 60;
            } else {
              const maxSize = 80;
              const ratio = Math.min(maxSize / imgEl.width, maxSize / imgEl.height);
              width = imgEl.width * ratio;
              height = imgEl.height * ratio;
            }
            
            // Account for device pixel ratio
            const x = item.position.x * dpr;
            const y = item.position.y * dpr;
            width *= dpr;
            height *= dpr;
            
            // Draw the image onto our temporary canvas
            tempCtx.drawImage(imgEl, x, y, width, height);
            resolve(true);
          };
          
          imgEl.onerror = () => {
            console.error(`Failed to load image: ${item.id}`);
            resolve(null);
          };
          
          imgEl.src = item.image.data_uri;
        });
      });
      
      // Wait for all images to be stamped
      await Promise.all(imagePromises);
      
      // Get the final image data from our temporary canvas
      const finalCanvasData = tempCanvas.toDataURL('image/png').split(',')[1];
      
      // Create and send the submission
      const submission = {
        subject: currentTopic.subject,
        problem: currentProblem.problem,
        solution_image: finalCanvasData,
        skill_id: currentTopic.skill?.id || '',
        subskill_id: currentTopic.subskill?.id || '',
        student_answer: '',
        canvas_used: true,
        student_id: studentId,
      };
      
      const response = await api.submitProblem(submission);
      setFeedback(response);
      if (onSubmit) onSubmit(finalCanvasData);
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
    <div className="relative flex flex-col h-full">
      {/* Add the VisualSceneManager component */}
      <VisualSceneManager
        scene={externalScene}
        workspaceRef={workspaceRef}
        onImagesCreated={handleSceneImagesCreated}
      />
      
      {/* Top Bar */}
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
          className={`transition-all duration-300 relative drawing-workspace ${isProblemOpen ? 'w-2/3' : 'w-full'}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleWorkspaceDrop}
        >
          <div className="h-full">
            <DrawingWorkspace 
              ref={drawingRef} 
              loading={loading} 
              captureImagesCallback={captureImagesForCanvas}
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
          </div>
        </div>
        
        {/* Image Browser Panel - only shown when toggle is on */}
        {isVisualToolsOpen && (
          <div className={`image-browser-sidebar ${isProblemOpen ? 'with-problem-panel' : ''}`}>
            <ImageBrowser onImageSelected={handleImageSelected} />
          </div>
        )}

        {/* Problem Panel */}
        {isProblemOpen && (
          <div className="w-1/3 bg-white border-l">
            <div className="p-4 flex flex-col h-full">
              <h2 className="text-xl font-semibold text-center mb-6">Current Problem</h2>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {!currentProblem ? (
                <div className="flex-1 flex items-center justify-center">
                  <Button
                    onClick={generateNewProblem}
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    Generate Problem
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex-1 space-y-4">
                    <p className="text-gray-700">{currentProblem.problem}</p>
                    {feedback && feedback.review && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                        <h3 className="font-medium">Feedback:</h3>
                        {feedback.review.feedback.praise && (
                          <div className="text-sm">
                            <p className="text-green-600">{feedback.review.feedback.praise}</p>
                          </div>
                        )}
                        {feedback.review.feedback.guidance && (
                          <div className="text-sm">
                            <p className="text-blue-600">{feedback.review.feedback.guidance}</p>
                          </div>
                        )}
                        {feedback.review.feedback.encouragement && (
                          <div className="text-sm">
                            <p className="text-purple-600">{feedback.review.feedback.encouragement}</p>
                          </div>
                        )}
                        {feedback.review.feedback.next_steps && (
                          <div className="text-sm mt-2">
                            <p className="text-gray-600">{feedback.review.feedback.next_steps}</p>
                          </div>
                        )}
                        {feedback.review.evaluation && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-sm font-medium">
                              Score: {feedback.review.evaluation}/10
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleSubmit}
                    className="w-full mt-4"
                    variant="default"
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Submit Answer'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default InteractiveWorkspace;