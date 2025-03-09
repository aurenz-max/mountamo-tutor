// Enhance the VisemeHandler.ts file with better timestamp synchronization

import * as THREE from 'three';

// Audio timing synchronization interface
interface AudioTimingInfo {
  serverTimestamp: number;   // Server timestamp of audio
  clientTimestamp: number;   // Client timestamp when scheduling
  scheduledPlaybackTime: number; // When audio is scheduled to play
  duration: number;          // Duration of audio in ms
  visemeLeadTime: number;    // How much to lead visemes before audio (ms)
}

/**
 * Enhanced viseme handler with timing synchronization
 */
export function createVisemeHandler(avatar: any, options: any = {}) {
  if (!avatar) {
    console.error('No avatar provided to createVisemeHandler');
    return null;
  }
  
  const config = {
    speakerId: '*',      // Default: accept any speaker
    enabled: true,       // Enable/disable the handler
    visemeLeadTime: 50,  // Default lead time in ms
    debug: false,        // Enable debug logging
    onVisemeApplied: null, // Optional callback
    ...options
  };
  
  // Store head mesh and morph references
  let headMesh: THREE.Mesh | null = null;
  let morphTargetInfluences: Float32Array | number[] | null = null;
  let morphDict: Record<string, number> = {};
  
  // Timing sync state
  let timingInfo: AudioTimingInfo | null = null;
  let serverClientTimeDiff = 0; // Time difference between server and client
  
  // Animation state
  const state = {
    // Current viseme state
    currentViseme: 'viseme_sil',
    currentIntensity: 0.0,
    // Target for smooth transitions
    targetViseme: 'viseme_sil',
    targetIntensity: 0.0,
    // Tracking and performance
    lastUpdateTime: 0,
    isTransitioning: false,
    transitionStartTime: 0,
    visemeQueue: [] as Array<{
      visemeId: number;
      timestamp: number;
      utteranceId: string;
      scheduledTime?: number;
    }>,
    animationFrameId: null as number | null,
    // Speaking state
    isSpeaking: false
  };
  
  // Animation timing configuration
  const TIMING = {
    transitionTime: 0.05,      // Increase from 0.05 to 0.08 for smoother transitions
    holdTime: 0.10,            // Keep at 0.10
    maxIntensity: 1.0,         // Maximum intensity
    silenceThreshold: 0.1,     // Intensity for silence
    maxQueueSize: 30,          // Maximum queue size
    easeFunction: (t) => t * t * (3 - 2 * t)  // Add easing function (smoothstep)
  };
  
  // Cache viseme indices for fast access
  const visemeIndices: Record<string, number> = {};
  
  // Oculus viseme target names - initialization only
  const OCULUS_VISEMES = [
    'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 
    'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 
    'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
  ];
  
  // Mapping from viseme IDs to Oculus viseme names
  const VISEME_ID_TO_NAME: Record<number, string> = {
    0: 'viseme_sil',  // Silence
    1: 'viseme_aa',   // AA
    2: 'viseme_aa',   // AH
    3: 'viseme_O',    // AW
    4: 'viseme_E',    // EE
    5: 'viseme_I',    // ER
    6: 'viseme_I',    // IH
    7: 'viseme_O',    // OH
    8: 'viseme_U',    // OO
    9: 'viseme_U',    // UH
    10: 'viseme_PP',  // PP
    11: 'viseme_FF',  // FF
    12: 'viseme_TH',  // TH
    13: 'viseme_DD',  // DD
    14: 'viseme_kk',  // KK
    15: 'viseme_CH',  // CH
    16: 'viseme_SS',  // SS
    17: 'viseme_nn',  // NN
    18: 'viseme_RR',  // RR
    19: 'viseme_aa',  // Additional vowel
    20: 'viseme_E'    // Additional vowel
  };
  
  // Find head mesh with morph targets - only called during initialization
  const findHeadMesh = () => {
    let foundMesh = null;
    
    avatar.traverse((object: any) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (!object.morphTargetDictionary || !object.morphTargetInfluences) return;
      
      const morphTargets = Object.keys(object.morphTargetDictionary);
      
      // Fast check for Oculus visemes
      let visemeCount = 0;
      for (const viseme of OCULUS_VISEMES) {
        if (morphTargets.includes(viseme)) visemeCount++;
        if (visemeCount >= 3) break; // Early exit after finding enough
      }
      
      if (visemeCount > 0) {
        foundMesh = object;
        return; // Exit traversal early
      }
    });
    
    if (foundMesh) {
      // Cache the morph data
      headMesh = foundMesh;
      morphTargetInfluences = foundMesh.morphTargetInfluences;
      
      // Create lookup dictionaries
      Object.entries(foundMesh.morphTargetDictionary).forEach(([name, index]) => {
        if (typeof index === 'number') {
          morphDict[name] = index;
          
          // Pre-cache indices for visemes
          if (name.startsWith('viseme_')) {
            visemeIndices[name] = index;
          }
        }
      });
      
      return foundMesh;
    }
    
    console.error('No head mesh with Oculus visemes found');
    return null;
  };
  
  // Set up audio timing synchronization
  const setupAudioSyncListener = () => {
    window.addEventListener('audio-playback-scheduled', (event: any) => {
      const newTimingInfo = event.detail as AudioTimingInfo;
      
      // Store timing info
      timingInfo = newTimingInfo;
      
      // Calculate server-client time difference
      serverClientTimeDiff = newTimingInfo.serverTimestamp - newTimingInfo.clientTimestamp;
      
      // Adjust viseme lead time if provided
      if (newTimingInfo.visemeLeadTime) {
        config.visemeLeadTime = newTimingInfo.visemeLeadTime;
      }
      
      if (config.debug) {
        console.log('Audio sync info updated:', {
          serverClientTimeDiff,
          leadTime: config.visemeLeadTime,
          timing: newTimingInfo
        });
      }
      
      // Re-schedule any pending visemes based on new timing
      rescheduleVisemeQueue();
    });
  };
  
  // Recalculate scheduling for all queued visemes
  const rescheduleVisemeQueue = () => {
    if (!timingInfo || state.visemeQueue.length === 0) return;
    
    // Get current time
    const now = performance.now();
    
    // For each viseme in queue, calculate when it should play relative to audio
    state.visemeQueue.forEach(viseme => {
      // Convert server timestamp to client time
      const clientTime = viseme.timestamp - serverClientTimeDiff;
      
      // Calculate time relative to audio playback
      const timeFromAudioStart = clientTime - timingInfo!.serverTimestamp;
      
      // Apply viseme lead time to make visemes appear slightly before the audio
      const adjustedTime = timingInfo!.scheduledPlaybackTime + timeFromAudioStart - config.visemeLeadTime;
      
      // Store the calculated playback time
      viseme.scheduledTime = adjustedTime;
    });
    
    // Sort queue by scheduled time
    state.visemeQueue.sort((a, b) => {
      return (a.scheduledTime || 0) - (b.scheduledTime || 0);
    });
    
    if (config.debug && state.visemeQueue.length > 0) {
      console.log(`Rescheduled ${state.visemeQueue.length} visemes, next at ${new Date(state.visemeQueue[0].scheduledTime || 0).toISOString()}`);
    }
  };
  
  // Apply a viseme directly with a specific intensity
  const applyViseme = (visemeName: string, intensity: number) => {
    if (!morphTargetInfluences) return false;
    
    // Get the index from our cached lookup
    const morphIndex = visemeIndices[visemeName];
    if (morphIndex !== undefined) {
      // Apply the viseme
      morphTargetInfluences[morphIndex] = intensity;
      
      // Notify via callback if configured
      if (config.onVisemeApplied && typeof config.onVisemeApplied === 'function') {
        config.onVisemeApplied(visemeName, intensity);
      }
      
      return true;
    }
    
    return false;
  };
  
  // Set a new target viseme with transition
  const setTargetViseme = (visemeName: string, intensity: number, timestamp: number) => {
    state.targetViseme = visemeName;
    state.targetIntensity = intensity;
    state.transitionStartTime = timestamp;
    state.isTransitioning = true;
  };
  
// In the animateVisemes function, update the transition code:
if (elapsed <= TIMING.transitionTime) {
  // Transition phase - blend between visemes
  const t = elapsed / TIMING.transitionTime;
  
  // Apply easing function for smoother transitions
  const easedT = TIMING.easeFunction(t);
  
  const newIntensity = state.currentIntensity * (1 - easedT) + state.targetIntensity * easedT;
  
  // If changing visemes, blend between them
  if (state.currentViseme !== state.targetViseme) {
    // Reduce current viseme with easing
    applyViseme(state.currentViseme, state.currentIntensity * (1 - easedT));
    
    // Increase target viseme with easing
    applyViseme(state.targetViseme, state.targetIntensity * easedT);
    
    // If transition complete, update current state
    if (t >= 1.0) {
      state.currentViseme = state.targetViseme;
      state.currentIntensity = state.targetIntensity;
    }
  } else {
    // Just update intensity for same viseme
    applyViseme(state.currentViseme, newIntensity);
    state.currentIntensity = newIntensity;
  }
}
  
  // Process a viseme event from the websocket
  const handleVisemeEvent = (event: any) => {
    if (!config.enabled) return;
    
    try {
      // Extract viseme data efficiently
      let visemeData;
      let speakerName;
      
      if (event.content?.data) {
        visemeData = event.content.data;
        speakerName = event.content.speaker;
      } else if (event.data) {
        visemeData = event.data;
        speakerName = event.speaker;
      } else {
        return;
      }
      
      // Check if this is a valid viseme event
      if (typeof visemeData.viseme_id !== 'number') {
        return;
      }
      
      // Check if this viseme is for our speaker
      const isSpeakerMatch = config.speakerId === '*' || speakerName === config.speakerId;
      if (!isSpeakerMatch) return;
      
      // Extract viseme info
      const { viseme_id } = visemeData;
      const audio_offset = visemeData.audio_offset || 0;
      const id = visemeData.id || `auto-${Date.now()}`;
      
      // Guard against oversized queue
      if (state.visemeQueue.length >= TIMING.maxQueueSize) {
        // Remove oldest items if queue is full
        state.visemeQueue = state.visemeQueue.slice(-TIMING.maxQueueSize/2);
      }
      
      // Add to viseme queue
      const visemeItem = {
        visemeId: viseme_id,
        timestamp: audio_offset || Date.now(),
        utteranceId: id
      };
      
      state.visemeQueue.push(visemeItem);
      state.isSpeaking = true;
      
      // If we have timing info, schedule this viseme
      if (timingInfo) {
        rescheduleVisemeQueue();
      }
      
    } catch (error) {
      console.error('Error processing viseme event:', error);
    }
  };
  
  // Clean up resources
  const destroy = () => {
    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }
    
    // Remove event listeners
    window.removeEventListener('audio-playback-scheduled', null);
  };
  
  // Initialize the handler
  const init = () => {
    const mesh = findHeadMesh();
    if (mesh) {
      // Set up audio sync listener
      setupAudioSyncListener();
      
      // Start the animation loop
      state.lastUpdateTime = performance.now();
      state.animationFrameId = requestAnimationFrame(animateVisemes);
      return true;
    }
    return false;
  };
  
  // Initialize
  const initialized = init();
  
  // Return the public API
  return {
    initialized,
    handleVisemeEvent,
    getCurrentViseme: () => state.currentViseme,
    getVisemeIntensity: () => state.currentIntensity,
    isSpeaking: () => state.isSpeaking,
    setSilence: () => {
      state.visemeQueue = [];
      setTargetViseme('viseme_sil', TIMING.silenceThreshold, performance.now());
      state.isSpeaking = false;
    },
    setVisemeLeadTime: (ms: number) => {
      config.visemeLeadTime = ms;
    },
    getQueueStatus: () => ({
      queueLength: state.visemeQueue.length,
      isTransitioning: state.isTransitioning,
      nextScheduledTime: state.visemeQueue[0]?.scheduledTime
    }),
    destroy
  };
}