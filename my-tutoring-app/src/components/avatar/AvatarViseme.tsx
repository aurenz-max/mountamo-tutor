'use client';

import { useEffect, useRef, useState } from 'react';
import { useAudioState } from '@/components/audio/AudioStateContext';
import * as THREE from 'three';

// Azure viseme IDs to morph target mappings for Ready Player Me avatar
const VISEME_MAPPINGS = {
  0: 'viseme_sil', // Silence/neutral position
  1: 'viseme_aa', // "ae" as in "bat"
  2: 'viseme_aa', // "ah" as in "father"
  3: 'viseme_O',  // "aw" as in "flaw"
  4: 'viseme_I',  // "ee" as in "meet"
  5: 'viseme_E',  // "er" as in "bird"
  6: 'viseme_I',  // "ih" as in "bit"
  7: 'viseme_O',  // "oh" as in "boat"
  8: 'viseme_U',  // "oo" as in "boot"
  9: 'viseme_U',  // "uh" as in "book"
  10: 'viseme_PP', // Bilabial plosives (p, b, m)
  11: 'viseme_FF', // Labiodental fricatives (f, v)
  12: 'viseme_TH', // Dental fricatives (th)
  13: 'viseme_DD', // Dental/alveolar plosives (t, d, n)
  14: 'viseme_kk', // Velar plosives (k, g)
  15: 'viseme_CH', // Postalveolar fricatives (sh, ch, j)
  16: 'viseme_SS', // Alveolar fricatives (s, z)
  17: 'viseme_nn', // Alveolar nasals (n)
  18: 'viseme_RR', // Alveolar approximants (r)
  19: 'viseme_aa', // Open front unrounded vowel
  20: 'viseme_E'   // Mid front unrounded vowel
};

// Viseme intensity configurations
const VISEME_CONFIG = {
  transitionTime: 0.05,  // Time in seconds to transition between visemes
  holdTime: 0.10,        // Time in seconds to hold a viseme at full intensity
  maxIntensity: 1.0,     // Maximum intensity value for visemes
  silenceThreshold: 0.1  // Intensity for silence viseme when not speaking
};

interface VisemeData {
  type: string;
  content: {
    type: string;
    session_id: string;
    student_id: number;
    speaker: string;
    timestamp: string;
    success: boolean;
    data: {
      viseme_id: number;
      audio_offset: number;
      id: string;
    }
  }
}

interface AvatarVisemeProps {
  avatar?: any;                // Three.js avatar object
  speakerId?: string;          // ID of the speaker to track
  enabled?: boolean;           // Whether viseme processing is enabled
  onVisemeApplied?: (viseme: string, intensity: number) => void; // Optional callback
}

/**
 * AvatarViseme component that handles viseme events from WebSocket
 * and applies them to the avatar's morph targets
 */
const AvatarViseme = ({ 
  avatar, 
  speakerId = 'current_speaker',
  enabled = true,
  onVisemeApplied
}: AvatarVisemeProps) => {
  const [currentViseme, setCurrentViseme] = useState('viseme_sil');
  const [visemeIntensity, setVisemeIntensity] = useState(0);
  const { audioState } = useAudioState();
  
  // Queue for incoming viseme events
  const visemeQueueRef = useRef<{
    visemeId: number,
    timestamp: number,
    utteranceId: string
  }[]>([]);
  
  // References for animation state
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const currentVisemeRef = useRef<string>('viseme_sil');
  const currentIntensityRef = useRef<number>(0);
  const targetVisemeRef = useRef<string>('viseme_sil');
  const targetIntensityRef = useRef<number>(0);
  const transitionStartTimeRef = useRef<number>(0);
  const isTransitioningRef = useRef<boolean>(false);
  
  // Reference to store avatar's morph targets for performance
  const morphTargetsRef = useRef<{[key: string]: number}>({});
  
  // Function to set up viseme handling on the avatar
  const setupVisemeHandling = () => {
    if (!avatar) return;
    
    // Find avatar's head or face mesh
    const headMesh = findHeadMesh(avatar);
    if (!headMesh) {
      console.warn('Could not find head/face mesh for visemes');
      return;
    }
    
    // Store available morph targets
    if (headMesh.morphTargetDictionary && headMesh.morphTargetInfluences) {
      const morphTargets: {[key: string]: number} = {};
      
      Object.entries(headMesh.morphTargetDictionary).forEach(([name, index]) => {
        if (typeof index === 'number') {
          morphTargets[name] = index;
        }
      });
      
      morphTargetsRef.current = morphTargets;
      console.log('Available morph targets:', Object.keys(morphTargets));
    } else {
      console.warn('Head mesh does not have morph targets');
    }
  };
  
  // Helper to find the head mesh in the avatar
  const findHeadMesh = (avatarModel: THREE.Object3D): THREE.Mesh | null => {
    let headMesh: THREE.Mesh | null = null;
    
    avatarModel.traverse((object) => {
      if (headMesh) return; // Already found
      
      if (object instanceof THREE.Mesh) {
        // Check if this mesh has the viseme morph targets
        const mesh = object as THREE.Mesh & {
          morphTargetDictionary?: {[key: string]: number},
          morphTargetInfluences?: number[]
        };
        
        if (mesh.morphTargetDictionary && 
            (mesh.morphTargetDictionary['viseme_sil'] !== undefined ||
             mesh.morphTargetDictionary['viseme_aa'] !== undefined)) {
          headMesh = mesh;
        }
      }
    });
    
    return headMesh;
  };
  
  // Apply a viseme to the avatar
  const applyViseme = (visemeName: string, intensity: number) => {
    if (!avatar) return;
    
    const headMesh = findHeadMesh(avatar);
    if (!headMesh) return;
    
    // Reset all viseme morph targets first
    Object.keys(VISEME_MAPPINGS).forEach(key => {
      const viseme = VISEME_MAPPINGS[Number(key)];
      if (morphTargetsRef.current[viseme] !== undefined) {
        const morphIndex = morphTargetsRef.current[viseme];
        if (headMesh.morphTargetInfluences && morphIndex < headMesh.morphTargetInfluences.length) {
          headMesh.morphTargetInfluences[morphIndex] = 0;
        }
      }
    });
    
    // Apply the current viseme
    if (morphTargetsRef.current[visemeName] !== undefined) {
      const morphIndex = morphTargetsRef.current[visemeName];
      if (headMesh.morphTargetInfluences && morphIndex < headMesh.morphTargetInfluences.length) {
        headMesh.morphTargetInfluences[morphIndex] = intensity;
        
        // Call the callback if provided
        if (onVisemeApplied) {
          onVisemeApplied(visemeName, intensity);
        }
      }
    }
  };
  
  // Animation loop for smooth viseme transitions
  const animateVisemes = (timestamp: number) => {
    if (!avatar || !enabled) {
      animationFrameRef.current = requestAnimationFrame(animateVisemes);
      return;
    }

    const deltaTime = timestamp - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = timestamp;
    
    // Process viseme queue if we're not in a transition
    if (!isTransitioningRef.current && visemeQueueRef.current.length > 0) {
      const nextViseme = visemeQueueRef.current.shift();
      if (nextViseme) {
        const visemeName = VISEME_MAPPINGS[nextViseme.visemeId] || 'viseme_sil';
        targetVisemeRef.current = visemeName;
        targetIntensityRef.current = VISEME_CONFIG.maxIntensity;
        transitionStartTimeRef.current = timestamp;
        isTransitioningRef.current = true;
      }
    }
    
    // Handle transitions between visemes
    if (isTransitioningRef.current) {
      const elapsed = (timestamp - transitionStartTimeRef.current) / 1000; // Convert to seconds
      
      if (elapsed <= VISEME_CONFIG.transitionTime) {
        // In transition phase
        const t = elapsed / VISEME_CONFIG.transitionTime;
        currentIntensityRef.current = currentIntensityRef.current * (1 - t) + targetIntensityRef.current * t;
        
        // Start blending to the new viseme
        if (currentVisemeRef.current !== targetVisemeRef.current) {
          // Apply the current viseme with reducing intensity
          applyViseme(currentVisemeRef.current, currentIntensityRef.current * (1 - t));
          
          // Apply the target viseme with increasing intensity
          applyViseme(targetVisemeRef.current, targetIntensityRef.current * t);
          
          // If we've completed the transition, update the current viseme
          if (t >= 1.0) {
            currentVisemeRef.current = targetVisemeRef.current;
          }
        } else {
          // Same viseme, just update intensity
          applyViseme(currentVisemeRef.current, currentIntensityRef.current);
        }
      } 
      else if (elapsed <= VISEME_CONFIG.transitionTime + VISEME_CONFIG.holdTime) {
        // Hold phase - keep the viseme at full intensity
        currentVisemeRef.current = targetVisemeRef.current;
        currentIntensityRef.current = targetIntensityRef.current;
        applyViseme(currentVisemeRef.current, currentIntensityRef.current);
      } 
      else {
        // End transition - return to silence if no more visemes
        if (visemeQueueRef.current.length === 0) {
          targetVisemeRef.current = 'viseme_sil';
          targetIntensityRef.current = VISEME_CONFIG.silenceThreshold;
          transitionStartTimeRef.current = timestamp;
          
          // Start transition to silence
          const elapsed = (timestamp - transitionStartTimeRef.current) / 1000;
          const t = Math.min(elapsed / VISEME_CONFIG.transitionTime, 1.0);
          
          // Blend from current viseme to silence
          applyViseme(currentVisemeRef.current, currentIntensityRef.current * (1 - t));
          applyViseme('viseme_sil', VISEME_CONFIG.silenceThreshold * t);
          
          // If transition complete, update current state
          if (t >= 1.0) {
            currentVisemeRef.current = 'viseme_sil';
            currentIntensityRef.current = VISEME_CONFIG.silenceThreshold;
            isTransitioningRef.current = false;
          }
        } else {
          // There are more visemes to process, end this transition
          isTransitioningRef.current = false;
        }
      }
    } else {
      // No active transitions, apply the current viseme
      applyViseme(currentVisemeRef.current, currentIntensityRef.current);
    }
    
    // Update state for UI if needed
    setCurrentViseme(currentVisemeRef.current);
    setVisemeIntensity(currentIntensityRef.current);
    
    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(animateVisemes);
  };
  
  // Initialize the animation loop
  useEffect(() => {
    // Set up avatar morph targets
    if (avatar) {
      setupVisemeHandling();
    }
    
    // Start animation loop
    lastUpdateTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(animateVisemes);
    
    // Clean up animation loop on unmount
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [avatar, enabled]);
  
  // Process incoming viseme events from the WebSocket
  const processVisemeEvent = (visemeData: VisemeData) => {
    if (!enabled || !avatar) return;
    
    // Check if this viseme is for our speaker
    if (visemeData.content.speaker !== speakerId) {
      // Only process visemes for the specified speaker
      return;
    }
    
    const { viseme_id, audio_offset, id } = visemeData.content.data;
    
    // Add to viseme queue
    visemeQueueRef.current.push({
      visemeId: viseme_id,
      timestamp: Date.now() + audio_offset,
      utteranceId: id
    });
    
    // Sort queue by timestamp
    visemeQueueRef.current.sort((a, b) => a.timestamp - b.timestamp);
  };
  
  // This function would be called from the parent component when
  // a new viseme event is received from the WebSocket
  const handleVisemeEvent = (visemeData: VisemeData) => {
    processVisemeEvent(visemeData);
  };
  
  // Return the handleVisemeEvent function so the parent component can call it
  return {
    handleVisemeEvent,
    currentViseme,
    visemeIntensity
  };
};

export default AvatarViseme;