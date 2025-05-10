// hooks/useScreenSharing.ts
import { useRef, useState, useCallback, useEffect } from 'react';

interface UseScreenSharingProps {
  sendScreenData: (imageData: string) => boolean;
  captureInterval?: number;
}

export const useScreenSharing = ({ 
  sendScreenData, 
  captureInterval = 2000 
}: UseScreenSharingProps) => {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenCaptureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const captureScreen = useCallback(async (stream: MediaStream): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        // Create video element to capture the stream
        const video = document.createElement('video');
        
        // Set up video element
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          // Start playing to get current frame
          video.play();
          
          // Create canvas for frame capture
          const canvas = document.createElement('canvas');
          
          // Determine optimal dimensions
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 720;
          
          let width = video.videoWidth;
          let height = video.videoHeight;
          
          // Scale down if necessary
          if (width > MAX_WIDTH) {
            const ratio = MAX_WIDTH / width;
            width = MAX_WIDTH;
            height = Math.floor(height * ratio);
          }
          
          if (height > MAX_HEIGHT) {
            const ratio = MAX_HEIGHT / height;
            height = MAX_HEIGHT;
            width = Math.floor(width * ratio);
          }
          
          // Set canvas dimensions
          canvas.width = width;
          canvas.height = height;
          
          // Draw the video frame to canvas
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, width, height);
          
          // Convert to JPEG and optimize quality
          const imageData = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
          
          // Stop video playback to release resources
          video.pause();
          video.srcObject = null;
          
          resolve(imageData);
        };
        
        video.onerror = (e) => {
          reject(new Error(`Video error: ${e}`));
        };
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  const stopScreenSharing = useCallback(() => {
    console.log('Stopping screen sharing...');
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (screenCaptureIntervalRef.current) {
      clearInterval(screenCaptureIntervalRef.current);
      screenCaptureIntervalRef.current = null;
    }
    
    setIsScreenSharing(false);
    console.log('Screen sharing stopped');
  }, []);

  const startScreenSharing = useCallback(async () => {
    try {
      console.log('Requesting screen sharing permission...');
      // Request screen capture permission with specific options for better quality
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          logicalSurface: true,
          frameRate: 5,
        }
      });
      console.log('Screen sharing permission granted');
      
      // Save reference to stream for cleanup
      screenStreamRef.current = stream;
      
      // Handle if user stops sharing through browser UI
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen sharing stopped by browser UI');
        stopScreenSharing();
      });
      
      // Set up interval to capture screen and send to Gemini
      screenCaptureIntervalRef.current = setInterval(async () => {
        try {
          // Capture and optimize screen content
          const imageData = await captureScreen(stream);
          
          // Send to server
          sendScreenData(imageData);
          console.log('Screen capture sent to server');
        } catch (error) {
          console.error('Error capturing screen:', error);
        }
      }, captureInterval);
      
      setIsScreenSharing(true);
      console.log('Screen sharing started successfully');
      return true;
    } catch (error) {
      // Handle case where user cancels the screen sharing dialog
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        console.log('Screen sharing permission denied by user');
      } else {
        console.error('Error starting screen sharing:', error);
        throw error;
      }
      return false;
    }
  }, [captureScreen, sendScreenData, captureInterval, stopScreenSharing]);

  const toggleScreenSharing = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenSharing();
      return true;
    } else {
      return await startScreenSharing();
    }
  }, [isScreenSharing, startScreenSharing, stopScreenSharing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScreenSharing();
    };
  }, [stopScreenSharing]);

  return {
    isScreenSharing,
    startScreenSharing,
    stopScreenSharing,
    toggleScreenSharing,
  };
};