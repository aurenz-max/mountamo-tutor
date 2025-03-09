'use client';

import { useEffect, useRef } from 'react';
import { useAudioState } from '@/components/audio/AudioStateContext';
import { createVisemeHandler } from '@/lib/visemeAnimationUtil';

interface AvatarVisemeProps {
  avatar?: any;                // Three.js avatar object
  speakerId?: string;          // ID of the speaker to track (or '*' for any)
  enabled?: boolean;           // Whether viseme processing is enabled
  onVisemeApplied?: (viseme: string, intensity: number) => void; // Optional callback
}

/**
 * A simplified AvatarViseme component that now uses the createVisemeHandler utility
 * This is now just a thin wrapper around the utility function,
 * maintained for backward compatibility
 */
const AvatarViseme = ({ 
  avatar, 
  speakerId = '*',
  enabled = true,
  onVisemeApplied
}: AvatarVisemeProps) => {
  // Audio state from context
  const { audioState } = useAudioState();
  
  // Reference for the viseme handler
  const visemeHandlerRef = useRef<any>(null);
  
  // Set up the viseme handler when avatar changes
  useEffect(() => {
    if (!avatar) {
      console.log('AvatarViseme: No avatar provided');
      return;
    }
    
    console.log('AvatarViseme: Creating viseme handler for avatar');
    
    try {
      // Create the viseme handler using our utility function
      const handler = createVisemeHandler(avatar, {
        speakerId,
        enabled,
        onVisemeApplied
      });
      
      // Store the reference
      visemeHandlerRef.current = handler;
      console.log('AvatarViseme: Viseme handler created successfully');
      
      // Clean up when unmounting or when avatar changes
      return () => {
        if (visemeHandlerRef.current && visemeHandlerRef.current.destroy) {
          console.log('AvatarViseme: Destroying viseme handler');
          visemeHandlerRef.current.destroy();
          visemeHandlerRef.current = null;
        }
      };
    } catch (error) {
      console.error('AvatarViseme: Error creating viseme handler:', error);
      return undefined;
    }
  }, [avatar, speakerId, enabled, onVisemeApplied]);
  
  // Return the handler and state for external use
  return {
    handleVisemeEvent: (event: any) => {
      if (visemeHandlerRef.current) {
        return visemeHandlerRef.current.handleVisemeEvent(event);
      }
    },
    currentViseme: visemeHandlerRef.current?.getCurrentViseme() || 'viseme_sil',
    visemeIntensity: visemeHandlerRef.current?.getVisemeIntensity() || 0,
    
    // Pass through utility methods
    clearVisemeQueue: () => visemeHandlerRef.current?.clearVisemeQueue(),
    setSilence: () => visemeHandlerRef.current?.setSilence(),
    testViseme: (visemeId: number) => visemeHandlerRef.current?.testViseme(visemeId),
    updateConfig: (config: any) => visemeHandlerRef.current?.updateConfig(config)
  };
};

export default AvatarViseme;