// src/lib/LipSyncManager.ts

import * as THREE from 'three';

/**
 * LipSyncManager - handles all viseme animation and audio synchronization
 */
export class LipSyncManager {
  // Configuration
  private config = {
    visemeLeadTime: 50,        // How early visemes appear before audio (ms)
    debug: false,              // Enable debug logging
    defaultTransitionTime: 70, // Default transition time (ms)
    maxQueueSize: 30,          // Maximum size of viseme queue
    silenceVisemeIntensity: 0.1 // Intensity for silence/neutral mouth position
  };

// Add these properties to the LipSyncManager class
private pendingVisemes: Array<{
  visemeId: number;
  visemeName: string;
  intensity: number;
  timestamp: number;
}> = [];

private lastProcessTimestamp: number = 0;
private directVisemeQueue: Array<{
  visemeName: string;
  intensity: number;
}> = [];
  
  // State
  private avatar: THREE.Object3D | null = null;
  private headMesh: THREE.Mesh | null = null;
  private morphTargetInfluences: Float32Array | null = null;
  private visemeIndices: Record<string, number> = {};
  private visemeQueue: any[] = [];
  private activeVisemes: any[] = [];
  private lastAudioTiming: any = null;
  private animationFrameId: number | null = null;
  private isSpeaking = false;
  private audioScheduledListener: any = null;
  private audioEndedListener: any = null;
  
  // Map from viseme IDs to Oculus viseme names
  private VISEME_ID_TO_NAME: Record<number, string> = {
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
    18: 'viseme_RR'   // RR
  };
  
  // Reverse mapping from name to ID
  private VISEME_NAME_TO_ID: Record<string, number> = {};
  
  // Viseme categories
  private VISEME_CATEGORIES = {
    silence: [0],                       // Silence/rest
    vowels: [1, 2, 3, 4, 5, 6, 7, 8, 9], // All vowels
    plosives: [10, 13, 14],             // B/P/M, D/T/N, K/G
    fricatives: [11, 12, 15, 16],       // F/V, TH, CH/SH, S/Z
    nasals: [17],                       // N/NG
    approximants: [18]                  // R/L/W
  };
  
  // Transition timing by category
  private CATEGORY_TRANSITIONS = {
    // From category (rows) to category (columns)
    'silence': {
      'vowels': { fadeIn: 100, hold: 120 },      // Slower opening from rest
      'plosives': { fadeIn: 40, hold: 30 },      // Quick closure from rest
      'fricatives': { fadeIn: 60, hold: 70 },    // Medium transition
      'default': { fadeIn: 80, hold: 80 }        // Default from silence
    },
    'vowels': {
      'vowels': { fadeIn: 80, hold: 150 },       // Vowel to vowel (smooth)
      'plosives': { fadeIn: 40, hold: 30 },      // Quick closure after vowel
      'fricatives': { fadeIn: 60, hold: 60 },    // Medium transition
      'default': { fadeIn: 70, hold: 90 }        // Default from vowels
    },
    'plosives': {
      'vowels': { fadeIn: 50, hold: 150 },       // Quick release to vowel
      'plosives': { fadeIn: 30, hold: 30 },      // Quick closure to closure
      'default': { fadeIn: 50, hold: 60 }        // Default from plosives
    },
    'fricatives': {
      'vowels': { fadeIn: 70, hold: 120 },       // Medium to vowel
      'default': { fadeIn: 60, hold: 70 }        // Default from fricatives
    },
    'nasals': {
      'vowels': { fadeIn: 60, hold: 100 },       // Nasal to vowel
      'default': { fadeIn: 60, hold: 60 }        // Default from nasals
    },
    'approximants': {
      'vowels': { fadeIn: 70, hold: 110 },       // Approximant to vowel
      'default': { fadeIn: 60, hold: 80 }        // Default from approximants
    },
    // Default timing if no specific category rule
    'default': {
      'default': { fadeIn: 70, hold: 80, fadeOut: 70 }
    }
  };
  
  // Special case transitions needing custom handling
  private SPECIAL_TRANSITIONS = {
    // Format: 'from_viseme-to_viseme': timing
    'viseme_sil-viseme_PP': { fadeIn: 30, hold: 30 },   // Quick motion to lip closure
    'viseme_PP-viseme_aa': { fadeIn: 40, hold: 170 },   // B to AH (explosive release)
    'viseme_FF-viseme_O': { fadeIn: 90, hold: 130 },    // F to O (special case)
    'viseme_SS-viseme_E': { fadeIn: 60, hold: 120 },    // S to E (common in English)
    'viseme_RR-viseme_E': { fadeIn: 70, hold: 100 }     // R to E (common in English)
  };
  
  constructor(options: Partial<typeof this.config> = {}) {
    // Apply custom options
    this.config = { ...this.config, ...options };
    
    // Build the reverse mapping
    Object.entries(this.VISEME_ID_TO_NAME).forEach(([id, name]) => {
      this.VISEME_NAME_TO_ID[name] = parseInt(id);
    });
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.log('LipSyncManager initialized');
  }
  
  /**
   * Set the avatar for lip sync
   */
  setAvatar(avatar: THREE.Object3D): boolean {
    this.avatar = avatar;
    const headMesh = this.findHeadMesh(avatar);
    
    if (headMesh) {
      this.headMesh = headMesh;
      this.setupMorphTargets();
      
      // Start animation loop
      if (!this.animationFrameId) {
        this.animationFrameId = requestAnimationFrame(this.animateVisemes.bind(this));
      }
      
      this.log('Avatar set successfully');
      return true;
    }
    
    this.error('No suitable head mesh found');
    return false;
  }
  
/**
 * Process any pending visemes in sync with the animation frame
 * This should be called from the animation loop
 */
public processPendingVisemes(timestamp: number): void {
  if (this.pendingVisemes.length === 0) return;
  
  // Calculate how much time has passed since last process
  const timeDelta = this.lastProcessTimestamp ? timestamp - this.lastProcessTimestamp : 16.7; // Default to ~60fps timing
  this.lastProcessTimestamp = timestamp;
  
  // Process all visemes that are ready based on their timestamp
  const now = performance.now();
  const readyVisemes = this.pendingVisemes.filter(v => now >= v.timestamp);
  
  if (readyVisemes.length > 0) {
    // Use the most recent viseme if multiple are ready
    const latestViseme = readyVisemes.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest, readyVisemes[0]);
    
    // Add this viseme to be directly applied at render time
    this.directVisemeQueue.push({
      visemeName: latestViseme.visemeName,
      intensity: latestViseme.intensity
    });
    
    // Remove processed visemes from the pending queue
    this.pendingVisemes = this.pendingVisemes.filter(v => !readyVisemes.includes(v));
    
    this.log(`Processed viseme: ${latestViseme.visemeName} (${readyVisemes.length} ready visemes)`);
  }
}

/**
 * Apply any queued direct visemes to the avatar
 * This should be called from the animation loop after animation update
 */
public applyQueuedVisemes(avatar: THREE.Object3D): void {
  if (this.directVisemeQueue.length === 0) return;
  
  // Take the most recent viseme in the queue
  const viseme = this.directVisemeQueue.pop();
  
  // Clear the queue (we only use the most recent one)
  this.directVisemeQueue = [];
  
  // Find the head mesh if we don't have it
  if (!this.headMesh) {
    this.headMesh = this.findHeadMesh(avatar);
    if (this.headMesh) {
      this.setupMorphTargets();
    }
  }
  
  // Apply the viseme directly to the mesh
  this.applyVisemeDirectly(viseme.visemeName, viseme.intensity);
}

/**
 * Apply a viseme directly to the mesh
 * This bypasses the animation system for immediate application
 */
private applyVisemeDirectly(visemeName: string, intensity: number, priority: boolean = false): boolean {
  if (!this.headMesh || !this.morphTargetInfluences) {
    this.error(`Cannot apply viseme ${visemeName}: no head mesh found`);
    return false;
  }
  
  // Get the index from the dictionary
  const index = this.visemeIndices[visemeName];
  
  if (index !== undefined) {
    // In priority mode, reset all other visemes first
    if (priority) {
      Object.keys(this.visemeIndices).forEach(name => {
        if (name !== visemeName) { // Skip the one we're setting
          const idx = this.visemeIndices[name];
          if (idx !== undefined && this.morphTargetInfluences) {
            this.morphTargetInfluences[idx] = 0;
          }
        }
      });
    }
    
    // Apply it directly to the morph targets
    this.morphTargetInfluences[index] = intensity;
    
    // Also directly set on the headMesh to be sure
    if (this.headMesh.morphTargetInfluences) {
      this.headMesh.morphTargetInfluences[index] = intensity;
    }
    
    this.log(`Applied viseme ${visemeName} with intensity ${intensity.toFixed(2)}`);
    
    // If this is a speaking viseme (not silence), update speaking state
    if (visemeName !== 'viseme_sil' && intensity > 0.1) {
      this.isSpeaking = true;
      
      // Create a timestamp for the last active viseme
      this.lastVisemeTime = performance.now();
    }
    
    return true;
  }
  
  this.error(`Viseme name not found: ${visemeName}`);
  return false;
}

/**
 * A new method to force all mouth morphs to the silence state
 * This is helpful when audio ends and we need to reset
 */
public setSilence(immediate: boolean = false): void {
  this.isSpeaking = false;
  
  // Apply silence viseme with priority
  this.applyVisemeDirectly('viseme_sil', this.config.silenceVisemeIntensity, true);
  
  // Clear any pending visemes
  this.pendingVisemes = [];
  this.directVisemeQueue = [];
  
  this.log(`Set mouth to silence state${immediate ? ' immediately' : ''}`);
}

/**
 * Check if we're currently speaking
 */
public isSpeaking(): boolean {
  // If we haven't received a viseme in a while, consider speaking stopped
  const now = performance.now();
  const timeSinceLastViseme = now - (this.lastVisemeTime || 0);
  
  // After 200ms without visemes, consider speaking done
  if (timeSinceLastViseme > 200 && this.isSpeaking) {
    this.isSpeaking = false;
  }
  
  return this.isSpeaking;
}

// Update the existing handleVisemeEvent method to use the pending queue
handleVisemeEvent(event: any): void {
  try {
    // Extract viseme data
    const visemeData = this.extractVisemeData(event);
    if (!visemeData) {
      this.error('Could not extract viseme data from event');
      return;
    }
    
    this.log(`Received viseme ID ${visemeData.visemeId}`);
    
    // Get viseme name
    const visemeName = this.VISEME_ID_TO_NAME[visemeData.visemeId] || 'viseme_sil';
    
    // Set speaking state
    this.isSpeaking = true;
    
    // Add to pending visemes queue
    this.pendingVisemes.push({
      visemeId: visemeData.visemeId,
      visemeName: visemeName,
      intensity: 1.0,
      timestamp: performance.now() // Use current time for immediate processing
    });
    
    // Limit queue size
    if (this.pendingVisemes.length > 10) {
      this.pendingVisemes = this.pendingVisemes.slice(-10);
    }
    
  } catch (error) {
    this.error('Error handling viseme event:', error);
  }
}
  
  /**
   * Handle audio scheduling information
   */
  handleAudioScheduled(
    serverTimestamp: number,
    scheduledPlaybackTime: number,
    duration: number
  ): void {
    const clientTimestamp = Date.now();
    
    this.lastAudioTiming = {
      serverTimestamp,
      clientTimestamp,
      scheduledPlaybackTime,
      duration
    };
    
    this.log('Audio timing updated', this.lastAudioTiming);
    
    // Reschedule any pending visemes with the new timing info
    this.rescheduleVisemeQueue();
  }
  
  /**
   * Handle audio playback ended
   */
  handleAudioEnded(): void {
    this.log('Audio playback ended');
    
    // Give a short grace period before setting speaking to false
    setTimeout(() => {
      this.isSpeaking = false;
      
      // If no visemes are active after a small delay, reset to silence
      setTimeout(() => {
        if (this.activeVisemes.length === 0 && !this.isSpeaking) {
          this.resetToSilence();
        }
      }, 300);
    }, 200);
  }
  
  /**
   * Reset the mouth to silence/closed position
   */
  resetToSilence(): void {
    this.log('Resetting to silence');
    
    // Clear queues
    this.visemeQueue = [];
    
    // Set up a transition to silence
    const now = performance.now();
    const silenceViseme = {
      visemeId: 0,
      visemeName: 'viseme_sil',
      startTime: now,
      elapsedTime: 0,
      maxIntensity: this.config.silenceVisemeIntensity,
      timing: {
        fadeIn: 100,
        hold: 0,
        fadeOut: 0,
        total: 100
      },
      completed: false
    };
    
    // Replace all active visemes with just the silence viseme
    this.activeVisemes = [silenceViseme];
  }
  
  /**
   * Test a specific viseme - useful for debugging
   */
  testViseme(visemeId: number, duration: number = 500): void {
    const visemeName = this.VISEME_ID_TO_NAME[visemeId] || 'viseme_sil';
    
    // Create a test viseme with longer duration for visibility
    const now = performance.now();
    const testViseme = {
      visemeId,
      visemeName,
      startTime: now,
      elapsedTime: 0,
      maxIntensity: 1.0,
      timing: {
        fadeIn: 100,
        hold: duration - 200,
        fadeOut: 100,
        total: duration
      },
      completed: false
    };
    
    // Add to active visemes
    this.activeVisemes.push(testViseme);
    
    this.log(`Testing viseme ${visemeId} (${visemeName}) for ${duration}ms`);
  }
  
  /**
   * Test a sequence of visemes - useful for debugging
   */
  testVisemeSequence(visemeIds: number[], interval: number = 300): void {
    let delay = 0;
    
    visemeIds.forEach((id, index) => {
      setTimeout(() => {
        this.testViseme(id, interval);
      }, delay);
      
      delay += interval - 50; // Slight overlap
    });
    
    this.log(`Testing viseme sequence: ${visemeIds.join(', ')}`);
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Remove event listeners
    window.removeEventListener('audio-playback-scheduled', this.audioScheduledListener);
    window.removeEventListener('audio-playback-ended', this.audioEndedListener);
    
    // Clear state
    this.visemeQueue = [];
    this.activeVisemes = [];
    this.isSpeaking = false;
    
    this.log('LipSyncManager destroyed');
  }
  
  /* Private Methods */
  
  // Setup event listeners for audio synchronization
  private setupEventListeners(): void {
    // Create bound versions of event handlers
    this.audioScheduledListener = (event: any) => {
      const detail = event.detail;
      this.handleAudioScheduled(
        detail.serverTimestamp,
        detail.scheduledPlaybackTime,
        detail.duration
      );
    };
    
    this.audioEndedListener = () => {
      this.handleAudioEnded();
    };
    
    // Add event listeners
    window.addEventListener('audio-playback-scheduled', this.audioScheduledListener);
    window.addEventListener('audio-playback-ended', this.audioEndedListener);
  }
  
  // Find the avatar's head mesh with morph targets
  private findHeadMesh(avatarModel: THREE.Object3D): THREE.Mesh | null {
    if (!avatarModel) return null;
    
    let bestMesh: THREE.Mesh | null = null;
    let bestScore = 0;
    
    // Define Oculus viseme targets to look for
    const oculusVisemes = [
      'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 
      'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 
      'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
    ];
    
    // Search through the avatar hierarchy
    avatarModel.traverse((object: THREE.Object3D) => {
      if (!(object instanceof THREE.Mesh)) return;
      
      const mesh = object as THREE.Mesh;
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      
      const morphTargets = Object.keys(mesh.morphTargetDictionary);
      let score = 0;
      
      // Check for Oculus visemes
      for (const viseme of oculusVisemes) {
        if (morphTargets.includes(viseme)) {
          score += 10;
        }
      }
      
      // Also check for general mouth-related morphs
      for (const morph of morphTargets) {
        if (morph.toLowerCase().includes('mouth') || 
            morph.toLowerCase().includes('lip') || 
            morph.toLowerCase().includes('jaw')) {
          score += 1;
        }
      }
      
      // Update best mesh if this one has a higher score
      if (score > bestScore) {
        bestMesh = mesh;
        bestScore = score;
      }
    });
    
    return bestMesh;
  }
  
  // Setup morph target mappings
  private setupMorphTargets(): void {
    if (!this.headMesh || !this.headMesh.morphTargetDictionary) return;
    
    // Store morph target references for faster access
    this.morphTargetInfluences = this.headMesh.morphTargetInfluences;
    
    // Cache viseme indices for quick access
    Object.entries(this.headMesh.morphTargetDictionary).forEach(([name, index]) => {
      if (typeof index === 'number' && name.startsWith('viseme_')) {
        this.visemeIndices[name] = index;
      }
    });
    
    this.log(`Found ${Object.keys(this.visemeIndices).length} viseme morph targets`);
  }
  
  // Extract viseme data from event
  private extractVisemeData(event: any): any {
    let visemeData = null;
    
    if (event.content?.data) {
      visemeData = event.content.data;
    } else if (event.data) {
      visemeData = event.data;
    }
    
    if (!visemeData || typeof visemeData.viseme_id !== 'number') {
      return null;
    }
    
    return {
      visemeId: visemeData.viseme_id,
      audioOffset: visemeData.audio_offset || 0,
      serverTimestamp: visemeData.server_timestamp || Date.now(),
      utteranceId: visemeData.id || `auto-${Date.now()}`
    };
  }
  
  // Schedule a viseme with precise timing
  private scheduleViseme(visemeData: any): void {
    // Prevent oversized queue
    if (this.visemeQueue.length >= this.config.maxQueueSize) {
      this.visemeQueue = this.visemeQueue.slice(-Math.floor(this.config.maxQueueSize/2));
    }
    
    // Get viseme name
    const visemeName = this.VISEME_ID_TO_NAME[visemeData.visemeId] || 'viseme_sil';
    
    // Get previous viseme for context (if any)
    const lastQueueItem = this.visemeQueue.length > 0 ? 
      this.visemeQueue[this.visemeQueue.length - 1] : null;
    const previousViseme = lastQueueItem ? 
      lastQueueItem.visemeName : 'viseme_sil';
    
    // Get transition timing based on context
    const timing = this.getTransitionTiming(previousViseme, visemeName);
    
    // Calculate when this viseme should be displayed
    const scheduledTime = this.calculateScheduledTime(visemeData);
    
    // Add to queue
    this.visemeQueue.push({
      ...visemeData,
      visemeName,
      scheduledTime,
      timing,
      previousViseme
    });
    
    // Sort by scheduled time
    this.visemeQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);
    
    this.log(`Scheduled ${visemeName} at ${new Date(scheduledTime).toLocaleTimeString()}, from ${previousViseme}`);
  }
  
  // Calculate transition timing based on phoneme categories
  private getTransitionTiming(fromViseme: string, toViseme: string): any {
    // Check for special case transitions first
    const specialKey = `${fromViseme}-${toViseme}`;
    if (this.SPECIAL_TRANSITIONS[specialKey]) {
      const special = this.SPECIAL_TRANSITIONS[specialKey];
      return {
        fadeIn: special.fadeIn,
        hold: special.hold,
        fadeOut: special.fadeOut || this.config.defaultTransitionTime,
        total: special.fadeIn + special.hold + (special.fadeOut || this.config.defaultTransitionTime)
      };
    }
    
    // Find categories for the visemes
    const fromId = this.VISEME_NAME_TO_ID[fromViseme];
    const toId = this.VISEME_NAME_TO_ID[toViseme];
    
    if (fromId === undefined || toId === undefined) {
      return {
        fadeIn: this.config.defaultTransitionTime,
        hold: this.config.defaultTransitionTime,
        fadeOut: this.config.defaultTransitionTime,
        total: this.config.defaultTransitionTime * 3
      };
    }
    
    // Find categories
    let fromCategory = 'default';
    let toCategory = 'default';
    
    Object.entries(this.VISEME_CATEGORIES).forEach(([category, ids]) => {
      if (ids.includes(fromId)) fromCategory = category;
      if (ids.includes(toId)) toCategory = category;
    });
    
    // Get transition timing by category
    const timing = 
      (this.CATEGORY_TRANSITIONS[fromCategory]?.[toCategory]) ||
      (this.CATEGORY_TRANSITIONS[fromCategory]?.default) ||
      (this.CATEGORY_TRANSITIONS.default.default);
    
    // Ensure all values are defined
    const fadeOut = timing.fadeOut || this.config.defaultTransitionTime;
    return {
      fadeIn: timing.fadeIn,
      hold: timing.hold,
      fadeOut: fadeOut,
      total: timing.fadeIn + timing.hold + fadeOut
    };
  }
  
  // Calculate when a viseme should be displayed
  private calculateScheduledTime(visemeData: any): number {
    if (!this.lastAudioTiming) {
      // No audio timing available, use reasonable default
      return Date.now() + visemeData.audioOffset;
    }
    
    const audioTiming = this.lastAudioTiming;
    
    // Base time when audio chunk starts
    const baseTime = audioTiming.scheduledPlaybackTime;
    
    // Add viseme's offset within the audio
    const scheduledTime = baseTime + visemeData.audioOffset;
    
    // Apply lead time so viseme appears before audio
    return scheduledTime - this.config.visemeLeadTime;
  }
  
  // Recalculate timing for all queued visemes
  private rescheduleVisemeQueue(): void {
    if (!this.lastAudioTiming || this.visemeQueue.length === 0) return;
    
    this.visemeQueue.forEach(viseme => {
      viseme.scheduledTime = this.calculateScheduledTime(viseme);
    });
    
    // Resort queue
    this.visemeQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);
    
    this.log(`Rescheduled ${this.visemeQueue.length} visemes`);
  }
  
  // Animation loop for viseme transitions
  private animateVisemes(timestamp: number): void {
    if (!this.headMesh || !this.morphTargetInfluences) {
      this.animationFrameId = requestAnimationFrame(this.animateVisemes.bind(this));
      return;
    }
    
    const now = performance.now();
    
    // Process visemes scheduled to start now
    while (this.visemeQueue.length > 0 && 
           this.visemeQueue[0].scheduledTime <= now) {
      
      const nextViseme = this.visemeQueue.shift();
      
      // Start animating this viseme
      this.activeVisemes.push({
        visemeId: nextViseme.visemeId,
        visemeName: nextViseme.visemeName,
        startTime: now,
        elapsedTime: 0,
        maxIntensity: 1.0,
        timing: nextViseme.timing,
        completed: false
      });
    }
    
    // Calculate all viseme influences for this frame
    const visemeInfluences: Record<string, number> = {};
    
    // Update all active visemes
    this.activeVisemes.forEach(viseme => {
      // Update elapsed time
      viseme.elapsedTime = now - viseme.startTime;
      
      // Calculate current intensity based on phase
      let intensity = 0;
      const timing = viseme.timing;
      
      if (viseme.elapsedTime < timing.fadeIn) {
        // Fade in phase - ease in
        const t = viseme.elapsedTime / timing.fadeIn;
        intensity = viseme.maxIntensity * this.easeInOut(t);
      } 
      else if (viseme.elapsedTime < timing.fadeIn + timing.hold) {
        // Hold phase - full intensity
        intensity = viseme.maxIntensity;
      }
      else if (viseme.elapsedTime < timing.total) {
        // Fade out phase - ease out
        const t = (viseme.elapsedTime - timing.fadeIn - timing.hold) / timing.fadeOut;
        intensity = viseme.maxIntensity * (1 - this.easeInOut(t));
      }
      else {
        // Complete
        viseme.completed = true;
        intensity = 0;
      }
      
      // Add this viseme's contribution to the influences map
      if (intensity > 0) {
        // Use max blending for overlapping visemes
        visemeInfluences[viseme.visemeName] = 
          Math.max(visemeInfluences[viseme.visemeName] || 0, intensity);
      }
    });
    
    // Apply all calculated influences
    this.applyVisemeInfluences(visemeInfluences);
    
    // Remove completed visemes
    this.activeVisemes = this.activeVisemes.filter(v => !v.completed);
    
    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(this.animateVisemes.bind(this));
  }
  
  // Apply all viseme influences simultaneously
  private applyVisemeInfluences(influences: Record<string, number>): void {
    // First reset all visemes
    Object.keys(this.visemeIndices).forEach(visemeName => {
      if (this.morphTargetInfluences) {
        const index = this.visemeIndices[visemeName];
        if (index !== undefined) {
          this.morphTargetInfluences[index] = 0;
        }
      }
    });
    
    // Then apply all active influences
    Object.entries(influences).forEach(([visemeName, intensity]) => {
      this.applyViseme(visemeName, intensity);
    });
    
    // If no visemes active, ensure resting face
    if (Object.keys(influences).length === 0 && !this.isSpeaking) {
      this.applyViseme('viseme_sil', this.config.silenceVisemeIntensity);
    }
  }
  
  // Apply a single viseme with specific intensity
  private applyViseme(visemeName: string, intensity: number): boolean {
    if (!this.morphTargetInfluences) return false;
    
    const index = this.visemeIndices[visemeName];
    if (index !== undefined) {
      this.morphTargetInfluences[index] = intensity;
      return true;
    }
    
    return false;
  }
  
  // Smooth cubic easing function for natural transitions
  private easeInOut(t: number): number {
    // Cubic easing function: smoother than linear
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  // Logging utilities
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[LipSync]', ...args);
    }
  }
  
  private error(...args: any[]): void {
    console.error('[LipSync]', ...args);
  }
}